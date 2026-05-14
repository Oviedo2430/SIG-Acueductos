"""
Servicio de modelado hidráulico usando WNTR.
Construye la red desde la BD (PostGIS) y ejecuta simulaciones.
Si la BD está vacía, usa la red de demostración para Labateca.
"""
import asyncio
import time
from typing import Optional

import wntr
from shapely.geometry import Point, shape as shapely_shape
from geoalchemy2.shape import to_shape
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.red import Tuberia, Nodo, Valvula, Tanque, Fuente, Dano

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
    tuberias, nodos, tanques, fuentes, danos, config: dict
) -> wntr.network.WaterNetworkModel:
    """Construye la red a partir de datos reales de PostGIS."""
    wn = wntr.network.WaterNetworkModel()
    _apply_options(wn, config)

    node_geoms: dict[str, Point] = {}

    for f in fuentes:
        if not f.geom:
            continue
        pt = to_shape(f.geom)
        wn.add_reservoir(f.codigo, base_head=f.cota_piezometrica_msnm or 1480.0,
                         coordinates=(pt.x, pt.y))
        node_geoms[f.codigo] = pt

    for t in tanques:
        if not t.geom:
            continue
        pt = to_shape(t.geom)
        wn.add_tank(t.codigo,
                    elevation=t.cota_fondo_msnm,
                    init_level=t.nivel_inicial_m or 2.0,
                    min_level=t.nivel_min_m or 0.0,
                    max_level=t.nivel_max_m or 3.0,
                    diameter=t.diametro_m or 5.0,
                    coordinates=(pt.x, pt.y))
        node_geoms[t.codigo] = pt

    for n in nodos:
        if not n.geom:
            continue
        pt = to_shape(n.geom)
        wn.add_junction(n.codigo,
                        base_demand=(n.demanda_base_lps or 0.0) / 1000.0,
                        elevation=n.cota_msnm,
                        coordinates=(pt.x, pt.y))
        node_geoms[n.codigo] = pt

    # Construir tuberías identificando nodos extremos por proximidad
    for i, tub in enumerate(tuberias):
        if not tub.geom:
            continue
        try:
            line = to_shape(tub.geom)
            start_pt = Point(line.coords[0])
            end_pt   = Point(line.coords[-1])

            start_name = _nearest_node(start_pt, node_geoms)
            end_name   = _nearest_node(end_pt,   node_geoms)

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
    for d in danos:
        if d.estado_reparacion == 'Reparado' or not d.geom:
            continue
        try:
            pt = to_shape(d.geom)
            nearest = _nearest_node(pt, node_geoms, tol=0.01) # Tolerancia mayor para asignar fuga a la red
            if nearest:
                node = wn.get_node(nearest)
                # Estimación simple del coeficiente de emisor basado en el volumen o severidad
                coeff = 0.5 if d.severidad == 'Alta' else 0.2 if d.severidad == 'Media' else 0.05
                # En WNTR (EPANET), el caudal de fuga es q = coeff * p^0.5
                node.emitter_coefficient = coeff
        except Exception:
            continue

    return wn


def _apply_options(wn: wntr.network.WaterNetworkModel, config: dict):
    wn.options.time.duration          = int(config.get("duracion_horas", 24)) * 3600
    wn.options.time.hydraulic_timestep = int(config.get("paso_tiempo_min", 60)) * 60
    wn.options.time.report_timestep   = int(config.get("paso_tiempo_min", 60)) * 60


def _nearest_node(pt: Point, node_geoms: dict, tol: float = 0.001) -> Optional[str]:
    best = None; best_d = float("inf")
    for name, g in node_geoms.items():
        d = pt.distance(g)
        if d < best_d:
            best_d = d; best = name
    return best if best_d < tol else None


def _extract_results(wn, results) -> dict:
    """Extrae y formatea los resultados de la simulación WNTR."""
    t0 = results.node["pressure"].index[0]

    pressure_s = results.node["pressure"].loc[t0]
    head_s     = results.node["head"].loc[t0]
    velocity_s = results.link["velocity"].loc[t0]
    flowrate_s = results.link["flowrate"].loc[t0]

    node_results = {}
    for name in pressure_s.index:
        p = float(pressure_s[name])
        node_results[name] = {
            "presion_mca": round(p, 2),
            "cota_piezometrica": round(float(head_s.get(name, 0)), 2),
        }

    pipe_results = {}
    for name in velocity_s.index:
        v = abs(float(velocity_s[name]))
        q = abs(float(flowrate_s.get(name, 0)))
        pipe_results[name] = {
            "velocidad_ms": round(v, 3),
            "caudal_lps": round(q * 1000, 3),
        }

    pressures = [v["presion_mca"] for v in node_results.values() if v["presion_mca"] >= 0]
    return {
        "node_results": node_results,
        "pipe_results": pipe_results,
        "stats": {
            "presion_min":   round(min(pressures), 2) if pressures else 0,
            "presion_max":   round(max(pressures), 2) if pressures else 0,
            "presion_media": round(sum(pressures) / len(pressures), 2) if pressures else 0,
            "nodos_criticos": sum(1 for p in pressures if p < 10.0),
            "nodos_total":    len(node_results),
            "tuberias_total": len(pipe_results),
        },
    }


def _run_sync(
    tuberias, nodos, tanques, fuentes, danos, config: dict
) -> dict:
    """Función síncrona que construye y ejecuta la simulación WNTR."""
    # Usar red real si hay datos; si no, usar demo
    use_demo = (not nodos) or (not tuberias)

    if use_demo:
        wn = _build_demo_model(config)
    else:
        wn = _build_db_model(tuberias, nodos, tanques, fuentes, danos, config)

    factor = config.get("factor_demanda", 1.0)
    if factor != 1.0:
        for junc in wn.junctions():
            junc[1].base_demand *= factor

    sim = wntr.sim.WNTRSimulator(wn)
    results = sim.run_sim()
    data = _extract_results(wn, results)
    data["es_demo"] = use_demo
    return data


async def ejecutar_simulacion(db: AsyncSession, config: dict) -> dict:
    """Entry point asíncrono para ejecutar la simulación en un thread pool."""
    tuberias = (await db.execute(select(Tuberia))).scalars().all()
    nodos    = (await db.execute(select(Nodo))).scalars().all()
    tanques  = (await db.execute(select(Tanque))).scalars().all()
    fuentes  = (await db.execute(select(Fuente))).scalars().all()
    danos    = (await db.execute(select(Dano))).scalars().all()

    loop = asyncio.get_event_loop()
    result = await loop.run_in_executor(
        None, _run_sync, tuberias, nodos, tanques, fuentes, danos, config
    )
    return result
