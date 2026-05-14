"""
Router para importación masiva de datos desde shapefiles (.zip).
Proceso:
  1. Recibe .zip con .shp .dbf .shx .prj
  2. Extrae a directorio temporal
  3. Lee con Fiona
  4. Transforma coordenadas EPSG:9377 → EPSG:4326 (pyproj)
  5. Mapea campos del shapefile a columnas de la BD
  6. Valida campos obligatorios
  7. Inserta en batch en PostgreSQL + PostGIS
"""
import os
import zipfile
import tempfile
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
import fiona
from fiona.crs import from_epsg
from pyproj import Transformer
from shapely.geometry import shape, Point, LineString
from geoalchemy2.shape import from_shape
import wntr

from app.database import get_db
from app.auth.dependencies import require_role
from app.models.red import Tuberia, Nodo, Valvula, Tanque, Fuente

router = APIRouter(prefix="/importacion", tags=["Importación de shapefiles"])

TipoLayer = Literal["tuberias", "nodos", "valvulas", "tanques", "fuentes"]

# ── Mapeo de campos shapefile → columnas de BD ────────────────
FIELD_MAP = {
    "tuberias": {
        "CODIGO":   "codigo",       "DIAMETRO": "diametro_mm",
        "MATERIAL": "material",     "RUGOS_HW": "rugosidad_hw",
        "AÑO_INST": "year_instalacion", "ESTADO": "estado",
        "PRES_MAX": "presion_max_mca",  "ZONA":   "zona_presion",
        "SECTOR":   "sector",       "OBS":      "observaciones",
    },
    "nodos": {
        "CODIGO":   "codigo",       "TIPO":     "tipo",
        "COTA":     "cota_msnm",    "DEM_BASE": "demanda_base_lps",
        "TIPO_USU": "tipo_usuario", "PRES_MIN": "presion_min_req_mca",
        "NUM_USU":  "num_usuarios", "ESTADO":   "estado",
    },
    "valvulas": {
        "CODIGO":   "codigo",       "TIPO":     "tipo",
        "ESTADO":   "estado",       "DIAMETRO": "diametro_mm",
        "COTA":     "cota_msnm",    "PRES_SET": "presion_setting",
    },
    "tanques": {
        "CODIGO":    "codigo",       "NOMBRE":    "nombre",
        "COTA_FOND": "cota_fondo_msnm", "COTA_TECH": "cota_techo_msnm",
        "NIV_INIC":  "nivel_inicial_m", "NIV_MIN":   "nivel_min_m",
        "NIV_MAX":   "nivel_max_m",     "CAPAC_M3":  "capacidad_m3",
        "DIAM_M":    "diametro_m",      "MATERIAL":  "material",
        "ESTADO":    "estado",
    },
    "fuentes": {
        "CODIGO":    "codigo",              "NOMBRE":    "nombre",
        "TIPO":      "tipo",                "COTA_PIEZ": "cota_piezometrica_msnm",
        "CAUDAL":    "caudal_disponible_lps", "ESTADO":  "estado",
    },
}

REQUIRED_FIELDS = {
    "tuberias": ["CODIGO", "DIAMETRO"],
    "nodos":    ["CODIGO", "COTA"],
    "valvulas": ["CODIGO", "TIPO"],
    "tanques":  ["CODIGO", "COTA_FOND", "COTA_TECH"],
    "fuentes":  ["CODIGO", "COTA_PIEZ"],
}

MODEL_MAP = {
    "tuberias": Tuberia, "nodos": Nodo,
    "valvulas": Valvula, "tanques": Tanque, "fuentes": Fuente,
}


def _find_shp(extract_dir: str) -> str:
    for root, _, files in os.walk(extract_dir):
        for f in files:
            if f.lower().endswith(".shp"):
                return os.path.join(root, f)
    raise HTTPException(400, "No se encontró archivo .shp dentro del .zip")


def _transform_geometry(geom_dict: dict, transformer: Transformer) -> dict:
    """Transforma las coordenadas de una geometría GeoJSON."""
    geom_type = geom_dict["type"]
    coords = geom_dict["coordinates"]

    def transform_coords(c):
        if isinstance(c[0], (int, float)):
            x, y = transformer.transform(c[0], c[1])
            return [x, y]
        return [transform_coords(sub) for sub in c]

    return {"type": geom_type, "coordinates": transform_coords(coords)}


@router.post("/shapefile/{tipo_layer}")
async def importar_shapefile(
    tipo_layer: TipoLayer,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_role("admin", "operador")),
):
    """
    Importa un shapefile (.zip) para la capa especificada.
    Transforma automáticamente de SIRGAS CTM-12 (EPSG:9377) a WGS84 (EPSG:4326).
    """
    if not file.filename.endswith(".zip"):
        raise HTTPException(400, "El archivo debe ser un .zip con el shapefile comprimido")

    field_map = FIELD_MAP[tipo_layer]
    required  = REQUIRED_FIELDS[tipo_layer]
    ModelCls  = MODEL_MAP[tipo_layer]

    # Transformador de coordenadas CTM-12 → WGS84
    transformer = Transformer.from_crs("EPSG:9377", "EPSG:4326", always_xy=True)

    importados = 0
    errores = []

    with tempfile.TemporaryDirectory() as tmpdir:
        # Guardar y extraer .zip
        zip_path = os.path.join(tmpdir, "upload.zip")
        content = await file.read()
        with open(zip_path, "wb") as f:
            f.write(content)

        with zipfile.ZipFile(zip_path, "r") as z:
            z.extractall(tmpdir)

        shp_path = _find_shp(tmpdir)

        with fiona.open(shp_path) as src:
            # Detectar si el CRS es proyectado (metros) para aplicar transformación
            src_crs = src.crs
            needs_transform = True  # Siempre transformamos desde EPSG:9377

            for i, feature in enumerate(src):
                try:
                    props = dict(feature.get("properties") or {})
                    geom_raw = dict(feature.get("geometry") or {})

                    # Validar campos obligatorios
                    missing = [f for f in required if props.get(f) is None]
                    if missing:
                        errores.append(f"Registro {i+1}: faltan campos {missing}")
                        continue

                    # Transformar coordenadas
                    if needs_transform:
                        geom_raw = _transform_geometry(geom_raw, transformer)

                    # Mapear campos
                    mapped = {}
                    for shp_field, db_field in field_map.items():
                        val = props.get(shp_field)
                        if val is not None:
                            mapped[db_field] = val

                    # Crear objeto ORM
                    shapely_geom = shape(geom_raw)
                    obj = ModelCls(
                        **mapped,
                        geom=from_shape(shapely_geom, srid=4326),
                        usuario_id=current_user.id,
                    )
                    db.add(obj)
                    importados += 1

                except Exception as e:
                    errores.append(f"Registro {i+1}: {str(e)}")

        await db.commit()

    return {
        "message": f"Importación completada para '{tipo_layer}'",
        "registros_importados": importados,
        "errores": errores[:20],  # Máx. 20 errores mostrados
        "total_errores": len(errores),
    }


@router.post("/validar/{tipo_layer}")
async def validar_shapefile(
    tipo_layer: TipoLayer,
    file: UploadFile = File(...),
    _=Depends(require_role("admin", "operador")),
):
    """
    Valida un shapefile sin importar los datos.
    Retorna conteo de registros válidos, errores y campos detectados.
    """
    if not file.filename.endswith(".zip"):
        raise HTTPException(400, "El archivo debe ser .zip")

    required = REQUIRED_FIELDS[tipo_layer]
    validos = 0; errores = []; campos_detectados = []

    with tempfile.TemporaryDirectory() as tmpdir:
        zip_path = os.path.join(tmpdir, "upload.zip")
        content = await file.read()
        with open(zip_path, "wb") as f: f.write(content)
        with zipfile.ZipFile(zip_path) as z: z.extractall(tmpdir)
        shp_path = _find_shp(tmpdir)

        with fiona.open(shp_path) as src:
            campos_detectados = list(src.schema["properties"].keys())
            missing_required = [r for r in required if r not in campos_detectados]
            if missing_required:
                raise HTTPException(422, f"Campos obligatorios faltantes: {missing_required}")

            for i, feature in enumerate(src):
                props = dict(feature.get("properties") or {})
                missing = [f for f in required if props.get(f) is None]
                if missing:
                    errores.append(f"Registro {i+1}: {missing}")
                else:
                    validos += 1

    return {
        "capa": tipo_layer,
        "registros_validos": validos,
        "registros_con_error": len(errores),
        "campos_detectados": campos_detectados,
        "campos_requeridos": required,
        "errores_muestra": errores[:10],
    }


@router.post("/epanet")
async def importar_epanet(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_role("admin", "operador")),
):
    """
    Importa un modelo de EPANET (.inp).
    Asume que las coordenadas del INP están en EPSG:9377 (CTM-12) y las transforma a WGS84 (EPSG:4326).
    """
    if not file.filename.lower().endswith(".inp"):
        raise HTTPException(400, "El archivo debe tener extensión .inp")

    transformer = Transformer.from_crs("EPSG:9377", "EPSG:4326", always_xy=True)

    with tempfile.NamedTemporaryFile(delete=False, suffix=".inp") as tmp:
        content = await file.read()
        tmp.write(content)
        tmp_path = tmp.name

    try:
        wn = wntr.network.WaterNetworkModel(tmp_path)
    except Exception as e:
        os.unlink(tmp_path)
        raise HTTPException(400, f"Error al parsear archivo EPANET: {str(e)}")

    # try-except block outside to capture DB errors
    try:
        importados = {"nodos": 0, "tuberias": 0, "tanques": 0, "fuentes": 0, "valvulas": 0}
        
        # 1. Fuentes (Reservoirs)
        for name, res in wn.reservoirs():
            if not res.coordinates: continue
            x, y = transformer.transform(res.coordinates[0], res.coordinates[1])
            obj = Fuente(
                codigo=name, nombre=name, tipo="Bocatoma",
                cota_piezometrica_msnm=res.base_head or 0.0,
                geom=from_shape(Point(x, y), srid=4326),
                usuario_id=current_user.id
            )
            db.add(obj)
            importados["fuentes"] += 1

        # 2. Tanques
        for name, t in wn.tanks():
            if not t.coordinates: continue
            x, y = transformer.transform(t.coordinates[0], t.coordinates[1])
            obj = Tanque(
                codigo=name, nombre=name,
                cota_fondo_msnm=t.elevation or 0.0,
                cota_techo_msnm=(t.elevation or 0.0) + (t.max_level or 3.0),
                nivel_inicial_m=t.init_level, nivel_min_m=t.min_level, nivel_max_m=t.max_level,
                diametro_m=t.diameter,
                geom=from_shape(Point(x, y), srid=4326),
                usuario_id=current_user.id
            )
            db.add(obj)
            importados["tanques"] += 1

        # 3. Nodos (Junctions)
        node_coords = {}
        for name, n in wn.junctions():
            if n.coordinates:
                x, y = transformer.transform(n.coordinates[0], n.coordinates[1])
                pt = Point(x, y)
            else:
                pt = Point(0, 0)
                
            node_coords[name] = pt
            
            dem_lps = n.base_demand * 1000 if hasattr(n, 'base_demand') and n.base_demand else 0
            obj = Nodo(
                codigo=name,
                cota_msnm=n.elevation or 0.0,
                demanda_base_lps=dem_lps,
                geom=from_shape(pt, srid=4326),
                usuario_id=current_user.id
            )
            db.add(obj)
            importados["nodos"] += 1

        # Agregar fuentes y tanques al dict de coordenadas para las tuberías
        for name, res in wn.reservoirs():
            if res.coordinates:
                x, y = transformer.transform(res.coordinates[0], res.coordinates[1])
                node_coords[name] = Point(x, y)
        for name, t in wn.tanks():
            if t.coordinates:
                x, y = transformer.transform(t.coordinates[0], t.coordinates[1])
                node_coords[name] = Point(x, y)

        # 4. Tuberías
        for name, p in wn.pipes():
            start_pt = node_coords.get(p.start_node_name)
            end_pt = node_coords.get(p.end_node_name)

            if start_pt and end_pt and start_pt != end_pt:
                line = LineString([start_pt, end_pt])
                obj = Tuberia(
                    codigo=name,
                    diametro_mm=p.diameter * 1000 if p.diameter else 0, # WNTR lo pasa a metros (SI)
                    rugosidad_hw=p.roughness,
                    geom=from_shape(line, srid=4326),
                    usuario_id=current_user.id
                )
                db.add(obj)
                importados["tuberias"] += 1
                
        # 5. Válvulas
        for name, v in wn.valves():
            start_pt = node_coords.get(v.start_node_name, Point(0, 0))
            obj = Valvula(
                codigo=name,
                tipo=v.valve_type,
                diametro_mm=v.diameter * 1000 if v.diameter else 0,
                geom=from_shape(start_pt, srid=4326),
                usuario_id=current_user.id
            )
            db.add(obj)
            importados["valvulas"] += 1

        await db.commit()
    except Exception as e:
        await db.rollback()
        os.unlink(tmp_path)
        raise HTTPException(500, f"Error al guardar en base de datos. Es posible que los IDs (códigos) ya existan o falte información. Detalle: {str(e)}")

    os.unlink(tmp_path)
    
    total = sum(importados.values())
    return {
        "message": "Red EPANET importada exitosamente",
        "registros_importados": total,
        "detalle": importados,
        "total_errores": 0
    }
