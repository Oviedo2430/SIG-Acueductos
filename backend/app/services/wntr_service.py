"""
Servicio de modelado hidráulico usando WNTR.
Construye la red desde la BD (PostGIS) y ejecuta simulaciones hidráulicas.
Incluye evaluación normativa según Resolución 0330/2017 y 0799/2021 (Arts. 61 y 62).
Si la BD está vacía, usa la red de demostración para Labateca.
"""
import asyncio
import copy
import time
from typing import Optional, Dict, Any, List

import wntr
from shapely.geometry import Point, shape as shapely_shape
from geoalchemy2.shape import to_shape
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.red import Tuberia, Nodo, Valvula, Tanque, Fuente, Dano
from app.core.normativa import evaluar_red_normativa, CRITERIOS_DEFAULT

# ── Red de demostración (cuando la BD está vacía) ────────────────────────────
DEMO_NETWORK = {
    "fuentes": [{"codigo": "FUE-001", "cota_piez": 1480.0, "x": -72.4880, "y": 7.3400}],
    "tanques": [{
        "codigo": "TAN-001", "cota_fondo": 1460.0, "init": 2.0,
        "min": 0.3, "max": 3.0, "diam": 7.0, "x": -72.4875, "y": 7.3393,
    }],
    "nodos": [
        {"codigo": "NOD-001", "cota": 1450.0, "dem": 0.5, "x": -72.4870, "y": 7.3385},
        {"codigo": "NOD-002", "cota": 1448.0, "dem": 0.3, "x": -72.4840, "y": 7.3385},
        {"codigo": "NOD-003", "cota": 1445.0, "dem": 0.8, "x": -72.4820, "y": 7.3380},
        {"codigo": "NOD-004", "cota": 1440.0, "dem": 0.2, "x": -72.4870, "y": 7.3360},
        {"codigo": "NOD-005", "cota": 1438.0, "dem": 0.6, "x": -72.4840, "y": 7.3360},
        {"codigo": "NOD-006", "cota": 1435.0, "dem": 0.4, "x": -72.4820, "y": 7.3360},
    ],
    "tuberias": [
        {"codigo": "TUB-001", "inicio": "TAN-001", "fin": "NOD-001", "long": 150, "diam": 0.100, "hw": 130},
        {"codigo": "TUB-002", "inicio": "NOD-001", "fin": "NOD-002", "long": 200, "diam": 0.075, "hw": 140},
        {"codigo": "TUB-003", "inicio": "NOD-002", "fin": "NOD-003", "long": 180, "diam": 0.050, "hw": 140},
        {"codigo": "TUB-004", "inicio": "NOD-001", "fin": "NOD-004", "long": 220, "diam": 0.075, "hw": 130},
        {"codigo": "TUB-005", "inicio": "NOD-002", "fin": "NOD-005", "long": 250, "diam": 0.050, "hw": 140},
        {"codigo": "TUB-006", "inicio": "NOD-004", "fin": "NOD-005", "long": 200, "diam": 0.050, "hw": 130},
        {"codigo": "TUB-007", "inicio": "NOD-005", "fin": "NOD-006", "long": 160, "diam": 0.050, "hw": 140},
    ],
    "conexion_fuente": {"fuente": "FUE-001", "tanque": "TAN-001", "long": 300, "diam": 0.150},
}


def _build_demo_model(config: dict) -> wntr.network.WaterNetworkModel:
    """Construye la red de demostración de Labateca."""
    wn = wntr.network.WaterNetworkModel()
    _apply_options(wn, config)

    net = DEMO_NETWORK
    for f in net["fuentes"]:
        wn.add_reservoir(f["codigo"], base_head=f["cota_piez"], coordinates=(f["x"], f["y"]))

    for t in net["tanques"]:
        wn.add_tank(t["codigo"], elevation=t["cota_fondo"], init_level=t["init"],
                    min_level=t["min"], max_level=t["max"], diameter=t["diam"],
                    coordinates=(t["x"], t["y"]))

    for n in net["nodos"]:
        wn.add_junction(n["codigo"], base_demand=n["dem"] / 1000.0,
                        elevation=n["cota"], coordinates=(n["x"], n["y"]))

    # Conexión fuente → tanque
    cx = net["conexion_fuente"]
    wn.add_pipe("PTUB-000", cx["fuente"], cx["tanque"], length=cx["long"],
                diameter=cx["diam"], roughness=100.0)

    for p in net["tuberias"]:
        wn.add_pipe(p["codigo"], p["inicio"], p["fin"],
                    length=p["long"], diameter=p["diam"], roughness=p["hw"])
    return wn


def _build_db_model(
    tuberias, nodos, tanques, fuentes, danos, valvulas, config: dict
) -> wntr.network.WaterNetworkModel:
    """Construye la red a partir de datos reales de PostGIS incluyendo tanques y válvulas."""
    wn = wntr.network.WaterNetworkModel()
    _apply_options(wn, config)

    node_geoms: dict[str, Point] = {}
    known_elevations: dict[str, float] = {}

    for f in fuentes:
        if not f.geom:
            continue
        pt = to_shape(f.geom)
        base_h = f.cota_piezometrica_msnm or 1661.97
        wn.add_reservoir(f.codigo, base_head=base_h, coordinates=(pt.x, pt.y))
        node_geoms[f.codigo] = pt
        known_elevations[f.codigo] = base_h

    for t in tanques:
        if not t.geom:
            continue
        pt = to_shape(t.geom)
        cota_f = t.cota_fondo_msnm or 1600.0
        wn.add_tank(t.codigo,
                    elevation=cota_f,
                    init_level=t.nivel_inicial_m or 2.0,
                    min_level=t.nivel_min_m or 0.0,
                    max_level=t.nivel_max_m or 3.0,
                    diameter=t.diametro_m or 5.0,
                    coordinates=(pt.x, pt.y))
        node_geoms[t.codigo] = pt
        known_elevations[t.codigo] = cota_f

    nodos_emisores = []
    
    for n in nodos:
        if not n.geom:
            continue
        pt = to_shape(n.geom)
        cota_n = n.cota_msnm if n.cota_msnm is not None else 1600.0
        wn.add_junction(n.codigo,
                        base_demand=(n.demanda_base_lps or 0.0) / 1000.0,
                        elevation=cota_n,
                        coordinates=(pt.x, pt.y))
        node_geoms[n.codigo] = pt
        known_elevations[n.codigo] = cota_n
        
        if getattr(n, 'tipo', None) == 'Conexion' and getattr(n, 'estado', 'Activo') == 'Activo':
            nodos_emisores.append(n.codigo)

    # Función auxiliar para obtener una cota realista si un extremo no conecta a ningún nodo
    def _fallback_elevation(pt: Point) -> float:
        best_cota = 1600.0
        best_d = float("inf")
        for name, g in node_geoms.items():
            if name in known_elevations:
                d = pt.distance(g)
                if d < best_d:
                    best_d = d
                    best_cota = known_elevations[name]
        return best_cota

    # ── Fase 10: Asignar Emisores por Fugas Físicas ──
    fugas_lps = config.get("fugas_lps", 0.0)
    if fugas_lps > 0 and len(nodos_emisores) > 0:
        fuga_por_nodo_lps = fugas_lps / len(nodos_emisores)
        coef_emisor = (fuga_por_nodo_lps / 1000.0) / (20.0 ** 0.5)
        for codigo in nodos_emisores:
            try:
                wn.get_node(codigo).emitter_coefficient = coef_emisor
            except Exception:
                pass

    # ── Incorporar Válvulas al Modelo WNTR (H-01, H-09) ──
    for v in (valvulas or []):
        s_name = getattr(v, "nodo_inicio", None)
        e_name = getattr(v, "nodo_fin", None)

        # Si no tiene nodos guardados explícitamente, buscar los dos más cercanos dentro de tolerancia
        if not (s_name and e_name and s_name in node_geoms and e_name in node_geoms):
            if v.geom:
                v_pt = to_shape(v.geom)
                sorted_nodes = sorted(
                    [(name, v_pt.distance(g)) for name, g in node_geoms.items()],
                    key=lambda x: x[1]
                )
                if len(sorted_nodes) >= 2 and sorted_nodes[0][1] < 5.0e-4 and sorted_nodes[1][1] < 5.0e-4:
                    s_name = sorted_nodes[0][0]
                    e_name = sorted_nodes[1][0]

        if s_name and e_name and s_name != e_name and s_name in node_geoms and e_name in node_geoms:
            v_diam = (v.diametro_mm or 50.0) / 1000.0
            v_type = v.tipo if v.tipo in ['PRV', 'TCV', 'GPV', 'FCV', 'PBV', 'CV'] else 'PRV'
            setting = float(v.presion_setting or 20.0)
            try:
                wn.add_valve(v.codigo, s_name, e_name, diameter=v_diam, valve_type=v_type, setting=setting)
            except Exception:
                pass

    # ── Construir tuberías identificando nodos extremos por proximidad ──
    for i, tub in enumerate(tuberias):
        if not tub.geom:
            continue
        try:
            line = to_shape(tub.geom)
            start_pt = Point(line.coords[0])
            end_pt   = Point(line.coords[-1])

            # Tolerancia de ~30 metros (3.0e-4 grados)
            start_name = _nearest_node(start_pt, node_geoms, tol=3.0e-4)
            if not start_name:
                start_name = f"NOD-EXT-{tub.codigo}-S"
                cota_real = _fallback_elevation(start_pt)
                wn.add_junction(start_name, base_demand=0.0, elevation=cota_real, coordinates=(start_pt.x, start_pt.y))
                node_geoms[start_name] = start_pt
                known_elevations[start_name] = cota_real

            end_name = _nearest_node(end_pt, node_geoms, tol=3.0e-4)
            if not end_name:
                end_name = f"NOD-EXT-{tub.codigo}-E"
                cota_real = _fallback_elevation(end_pt)
                wn.add_junction(end_name, base_demand=0.0, elevation=cota_real, coordinates=(end_pt.x, end_pt.y))
                node_geoms[end_name] = end_pt
                known_elevations[end_name] = cota_real

            if not start_name or not end_name or start_name == end_name:
                continue

            length_m = line.length * 111_320  # grados → metros (aprox.)
            wn.add_pipe(
                tub.codigo,
                start_name, end_name,
                length=max(length_m, 5.0),
                diameter=(tub.diametro_mm or 50) / 1000.0,
                roughness=tub.rugosidad_hw or 130.0,
            )
        except Exception:
            continue

    # Agregar daños no reparados como "Emisores" (fugas) a los nodos más cercanos
    for d in (danos or []):
        if d.estado_reparacion == 'Reparado' or not d.geom:
            continue
        try:
            pt = to_shape(d.geom)
            nearest = _nearest_node(pt, node_geoms, tol=0.01)
            if nearest:
                node = wn.get_node(nearest)
                coeff = 0.5 if d.severidad == 'Alta' else 0.2 if d.severidad == 'Media' else 0.05
                node.emitter_coefficient = coeff
        except Exception:
            continue

    return wn


def _apply_options(wn: wntr.network.WaterNetworkModel, config: dict):
    wn.options.time.duration           = int(config.get("duracion_horas", 24)) * 3600
    wn.options.time.hydraulic_timestep = int(config.get("paso_tiempo_min", 60)) * 60
    wn.options.time.report_timestep    = int(config.get("paso_tiempo_min", 60)) * 60
    wn.options.hydraulic.headloss      = "H-W"
    wn.options.hydraulic.inpfile_units = "LPS"


def _nearest_node(pt: Point, node_geoms: dict, tol: float = 0.001) -> Optional[str]:
    best = None
    best_d = float("inf")
    for name, g in node_geoms.items():
        d = pt.distance(g)
        if d < best_d:
            best_d = d
            best = name
    return best if best_d < tol else None


def _extract_results(wn, results_din, results_est=None) -> dict:
    """Extrae resultados dinámicos y estáticos, evaluando la normativa colombiana RAS."""
    t0_din = results_din.node["pressure"].index[0]

    pressure_s = results_din.node["pressure"].loc[t0_din]
    head_s     = results_din.node["head"].loc[t0_din]
    velocity_s = results_din.link["velocity"].loc[t0_din]
    flowrate_s = results_din.link["flowrate"].loc[t0_din]

    # Presión estática (si se ejecutó el caso de demanda cero)
    pressure_est_s = None
    if results_est is not None:
        try:
            t0_est = results_est.node["pressure"].index[0]
            pressure_est_s = results_est.node["pressure"].loc[t0_est]
        except Exception:
            pressure_est_s = None

    node_results = {}
    p_din_map = {}
    p_est_map = {}

    for name in pressure_s.index:
        p_din = float(pressure_s[name])
        p_est = float(pressure_est_s[name]) if pressure_est_s is not None and name in pressure_est_s else p_din

        is_infra = (
            name.upper().startswith("EMB") or
            name.upper().startswith("FUE") or
            name.upper().startswith("TAN") or
            name.startswith("NOD-EXT")
        )

        node_results[name] = {
            "presion_mca": round(p_din, 1),
            "presion_estatica_mca": round(p_est, 1),
            "cota_piezometrica": round(float(head_s.get(name, 0)), 1),
        }

        # Solo nodos de la red para estadísticas y cumplimiento normativo
        if not is_infra:
            p_din_map[name] = p_din
            p_est_map[name] = p_est

    # ── Evaluación Normativa RAS (Resolución 0330 / 0799) ──
    eval_ras = evaluar_red_normativa(p_din_map, p_est_map)
    for name, clase in eval_ras["clases_nodo"].items():
        if name in node_results:
            node_results[name]["clase_normativa"] = clase

    pipe_results = {}
    for name in velocity_s.index:
        v = abs(float(velocity_s[name]))
        q = abs(float(flowrate_s.get(name, 0)))
        pipe_results[name] = {
            "velocidad_ms": round(v, 2),
            "caudal_lps": round(q * 1000, 1),
        }

    # Presiones de nodos reales para evitar distorsión de fuentes/tanques (H-13)
    net_pressures = list(p_din_map.values()) if p_din_map else [v["presion_mca"] for v in node_results.values()]

    return {
        "node_results": node_results,
        "pipe_results": pipe_results,
        "stats": {
            "presion_min":          round(min(net_pressures), 1) if net_pressures else 0,
            "presion_max":          round(max(net_pressures), 1) if net_pressures else 0,
            "presion_media":        round(sum(net_pressures) / len(net_pressures), 1) if net_pressures else 0,
            "nodos_criticos":       sum(1 for p in net_pressures if p < 10.0 or p > 50.0),
            "nodos_total":          len(net_pressures),
            "tuberias_total":       len(pipe_results),
            "pct_cumplimiento_ras": eval_ras["pct_cumplimiento"],
            "cumple_art61":         eval_ras["cumple_art61"],
            "cumple_art62":         eval_ras["cumple_art62"],
            "conteo_normativo":     eval_ras["conteo"],
        },
    }


def _run_sync(
    tuberias, nodos, tanques, fuentes, danos, valvulas, config: dict
) -> dict:
    """Función síncrona que construye y ejecuta la simulación dinámica y estática en WNTR."""
    use_demo = (not nodos) or (not tuberias)

    if use_demo:
        wn = _build_demo_model(config)
    else:
        wn = _build_db_model(tuberias, nodos, tanques, fuentes, danos, valvulas, config)

    factor = config.get("factor_demanda", 1.0)
    if factor != 1.0:
        for junc in wn.junctions():
            junc[1].base_demand *= factor

    # 1. Simulación Dinámica
    sim_din = wntr.sim.WNTRSimulator(wn)
    results_din = sim_din.run_sim()

    # 2. Simulación Estática (Demanda nula para Art. 62 RAS)
    results_est = None
    try:
        wn_est = copy.deepcopy(wn)
        for _, junc in wn_est.junctions():
            junc.base_demand = 0.0
            for d in getattr(junc, "demand_timeseries_list", []):
                d.base_value = 0.0
        wn_est.options.time.duration = 0
        sim_est = wntr.sim.WNTRSimulator(wn_est)
        results_est = sim_est.run_sim()
    except Exception:
        results_est = None

    data = _extract_results(wn, results_din, results_est)
    data["es_demo"] = use_demo
    return data


async def ejecutar_simulacion(db: AsyncSession, config: dict) -> dict:
    """Entry point asíncrono para ejecutar la simulación en un thread pool."""
    tuberias = (await db.execute(select(Tuberia))).scalars().all()
    nodos    = (await db.execute(select(Nodo))).scalars().all()
    tanques  = (await db.execute(select(Tanque))).scalars().all()
    fuentes  = (await db.execute(select(Fuente))).scalars().all()
    danos    = (await db.execute(select(Dano))).scalars().all()
    valvulas = (await db.execute(select(Valvula))).scalars().all()

    loop = asyncio.get_event_loop()
    result = await loop.run_in_executor(
        None, _run_sync, tuberias, nodos, tanques, fuentes, danos, valvulas, config
    )
    return result
