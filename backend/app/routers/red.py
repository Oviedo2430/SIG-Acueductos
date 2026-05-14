"""
Router unificado para las 5 capas de la red de acueducto.
Endpoints CRUD + GeoJSON para cada tipo de elemento.
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, text
from typing import Optional

from app.database import get_db
from app.auth.dependencies import get_current_user, require_role
from app.lib.geo import geom_to_geojson, geojson_to_geom
from app.models.red import Tuberia, Nodo, Valvula, Tanque, Fuente
from app.schemas.red import (
    TuberiaCreate, TuberiaUpdate, TuberiaResponse,
    NodoCreate, NodoUpdate, NodoResponse,
    ValvulaCreate, ValvulaUpdate, ValvulaResponse,
    TanqueCreate, TanqueUpdate, TanqueResponse,
    FuenteCreate, FuenteUpdate, FuenteResponse,
)

router = APIRouter(tags=["Red de acueducto"])

CanEdit = Depends(require_role("admin", "operador"))
CanView = Depends(get_current_user)


def _serialize(obj, model_class) -> dict:
    """Serializa un objeto ORM incluyendo geometría como GeoJSON."""
    d = {c.name: getattr(obj, c.name) for c in obj.__table__.columns}
    d["geom"] = geom_to_geojson(obj.geom)
    return d


def _as_feature_collection(objs) -> dict:
    """Convierte lista de objetos ORM a GeoJSON FeatureCollection."""
    features = []
    for obj in objs:
        props = {c.name: getattr(obj, c.name) for c in obj.__table__.columns if c.name != "geom"}
        features.append({
            "type": "Feature",
            "geometry": geom_to_geojson(obj.geom),
            "properties": props,
        })
    return {"type": "FeatureCollection", "features": features}


# ═══════════════════════════════════════════════════════════════
# TUBERÍAS
# ═══════════════════════════════════════════════════════════════
@router.get("/tuberias/geojson")
async def tuberias_geojson(db: AsyncSession = Depends(get_db), _=CanView):
    """Retorna todas las tuberías como GeoJSON FeatureCollection (para MapLibre)."""
    result = await db.execute(select(Tuberia))
    return _as_feature_collection(result.scalars().all())


@router.get("/tuberias")
async def listar_tuberias(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=500),
    estado: Optional[str] = None,
    material: Optional[str] = None,
    sector: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    _=CanView,
):
    q = select(Tuberia)
    if estado:   q = q.where(Tuberia.estado == estado)
    if material: q = q.where(Tuberia.material == material)
    if sector:   q = q.where(Tuberia.sector == sector)

    total_r = await db.execute(select(func.count()).select_from(q.subquery()))
    total = total_r.scalar()
    result = await db.execute(q.offset((page - 1) * limit).limit(limit))
    items = [_serialize(r, Tuberia) for r in result.scalars().all()]
    return {"total": total, "page": page, "limit": limit, "data": items}


@router.get("/tuberias/{item_id}")
async def obtener_tuberia(item_id: int, db: AsyncSession = Depends(get_db), _=CanView):
    r = await db.execute(select(Tuberia).where(Tuberia.id == item_id))
    obj = r.scalar_one_or_none()
    if not obj: raise HTTPException(404, "Tubería no encontrada")
    return _serialize(obj, Tuberia)


@router.post("/tuberias", status_code=201)
async def crear_tuberia(data: TuberiaCreate, db: AsyncSession = Depends(get_db), _=CanEdit):
    obj = Tuberia(**data.model_dump(exclude={"geom"}), geom=geojson_to_geom(data.geom.model_dump()))
    db.add(obj); await db.commit(); await db.refresh(obj)
    return _serialize(obj, Tuberia)


@router.put("/tuberias/{item_id}")
async def actualizar_tuberia(item_id: int, data: TuberiaUpdate, db: AsyncSession = Depends(get_db), _=CanEdit):
    r = await db.execute(select(Tuberia).where(Tuberia.id == item_id))
    obj = r.scalar_one_or_none()
    if not obj: raise HTTPException(404, "Tubería no encontrada")
    update_data = data.model_dump(exclude_none=True)
    if "geom" in update_data:
        obj.geom = geojson_to_geom(update_data.pop("geom"))
    for k, v in update_data.items():
        setattr(obj, k, v)
    await db.commit(); await db.refresh(obj)
    return _serialize(obj, Tuberia)


@router.delete("/tuberias/{item_id}", status_code=204)
async def eliminar_tuberia(item_id: int, db: AsyncSession = Depends(get_db), _=Depends(require_role("admin"))):
    r = await db.execute(select(Tuberia).where(Tuberia.id == item_id))
    obj = r.scalar_one_or_none()
    if not obj: raise HTTPException(404, "Tubería no encontrada")
    await db.delete(obj); await db.commit()


# ═══════════════════════════════════════════════════════════════
# NODOS
# ═══════════════════════════════════════════════════════════════
@router.get("/nodos/geojson")
async def nodos_geojson(db: AsyncSession = Depends(get_db), _=CanView):
    result = await db.execute(select(Nodo))
    return _as_feature_collection(result.scalars().all())


@router.get("/nodos")
async def listar_nodos(
    page: int = Query(1, ge=1), limit: int = Query(50, ge=1, le=500),
    estado: Optional[str] = None, tipo: Optional[str] = None,
    db: AsyncSession = Depends(get_db), _=CanView,
):
    q = select(Nodo)
    if estado: q = q.where(Nodo.estado == estado)
    if tipo:   q = q.where(Nodo.tipo == tipo)
    total_r = await db.execute(select(func.count()).select_from(q.subquery()))
    result = await db.execute(q.offset((page - 1) * limit).limit(limit))
    return {"total": total_r.scalar(), "page": page, "limit": limit, "data": [_serialize(r, Nodo) for r in result.scalars().all()]}


@router.get("/nodos/{item_id}")
async def obtener_nodo(item_id: int, db: AsyncSession = Depends(get_db), _=CanView):
    r = await db.execute(select(Nodo).where(Nodo.id == item_id))
    obj = r.scalar_one_or_none()
    if not obj: raise HTTPException(404, "Nodo no encontrado")
    return _serialize(obj, Nodo)


@router.post("/nodos", status_code=201)
async def crear_nodo(data: NodoCreate, db: AsyncSession = Depends(get_db), _=CanEdit):
    obj = Nodo(**data.model_dump(exclude={"geom"}), geom=geojson_to_geom(data.geom.model_dump()))
    db.add(obj); await db.commit(); await db.refresh(obj)
    return _serialize(obj, Nodo)


@router.put("/nodos/{item_id}")
async def actualizar_nodo(item_id: int, data: NodoUpdate, db: AsyncSession = Depends(get_db), _=CanEdit):
    r = await db.execute(select(Nodo).where(Nodo.id == item_id))
    obj = r.scalar_one_or_none()
    if not obj: raise HTTPException(404, "Nodo no encontrado")
    update_data = data.model_dump(exclude_none=True)
    if "geom" in update_data: obj.geom = geojson_to_geom(update_data.pop("geom"))
    for k, v in update_data.items(): setattr(obj, k, v)
    await db.commit(); await db.refresh(obj)
    return _serialize(obj, Nodo)


@router.delete("/nodos/{item_id}", status_code=204)
async def eliminar_nodo(item_id: int, db: AsyncSession = Depends(get_db), _=Depends(require_role("admin"))):
    r = await db.execute(select(Nodo).where(Nodo.id == item_id))
    obj = r.scalar_one_or_none()
    if not obj: raise HTTPException(404, "Nodo no encontrado")
    await db.delete(obj); await db.commit()


# ═══════════════════════════════════════════════════════════════
# VÁLVULAS, TANQUES, FUENTES (mismo patrón)
# ═══════════════════════════════════════════════════════════════
for _model, _prefix, _label, _create, _update in [
    (Valvula, "valvulas", "Válvula", ValvulaCreate, ValvulaUpdate),
    (Tanque,  "tanques",  "Tanque",  TanqueCreate,  TanqueUpdate),
    (Fuente,  "fuentes",  "Fuente",  FuenteCreate,  FuenteUpdate),
]:
    # Se registran dinámicamente — ver abajo para las funciones
    pass


@router.get("/valvulas/geojson")
async def valvulas_geojson(db: AsyncSession = Depends(get_db), _=CanView):
    result = await db.execute(select(Valvula)); return _as_feature_collection(result.scalars().all())

@router.get("/valvulas")
async def listar_valvulas(page: int = Query(1, ge=1), limit: int = Query(50, ge=1, le=500), db: AsyncSession = Depends(get_db), _=CanView):
    q = select(Valvula)
    total_r = await db.execute(select(func.count()).select_from(q.subquery()))
    result = await db.execute(q.offset((page - 1) * limit).limit(limit))
    return {"total": total_r.scalar(), "page": page, "limit": limit, "data": [_serialize(r, Valvula) for r in result.scalars().all()]}

@router.get("/valvulas/{item_id}")
async def obtener_valvula(item_id: int, db: AsyncSession = Depends(get_db), _=CanView):
    r = await db.execute(select(Valvula).where(Valvula.id == item_id))
    obj = r.scalar_one_or_none()
    if not obj: raise HTTPException(404, "Válvula no encontrada"); return _serialize(obj, Valvula)

@router.post("/valvulas", status_code=201)
async def crear_valvula(data: ValvulaCreate, db: AsyncSession = Depends(get_db), _=CanEdit):
    obj = Valvula(**data.model_dump(exclude={"geom"}), geom=geojson_to_geom(data.geom.model_dump()))
    db.add(obj); await db.commit(); await db.refresh(obj); return _serialize(obj, Valvula)

@router.put("/valvulas/{item_id}")
async def actualizar_valvula(item_id: int, data: ValvulaUpdate, db: AsyncSession = Depends(get_db), _=CanEdit):
    r = await db.execute(select(Valvula).where(Valvula.id == item_id))
    obj = r.scalar_one_or_none()
    if not obj: raise HTTPException(404, "Válvula no encontrada")
    ud = data.model_dump(exclude_none=True)
    if "geom" in ud: obj.geom = geojson_to_geom(ud.pop("geom"))
    for k, v in ud.items(): setattr(obj, k, v)
    await db.commit(); await db.refresh(obj); return _serialize(obj, Valvula)

@router.delete("/valvulas/{item_id}", status_code=204)
async def eliminar_valvula(item_id: int, db: AsyncSession = Depends(get_db), _=Depends(require_role("admin"))):
    r = await db.execute(select(Valvula).where(Valvula.id == item_id))
    obj = r.scalar_one_or_none()
    if not obj: raise HTTPException(404)
    await db.delete(obj); await db.commit()


@router.get("/tanques/geojson")
async def tanques_geojson(db: AsyncSession = Depends(get_db), _=CanView):
    result = await db.execute(select(Tanque)); return _as_feature_collection(result.scalars().all())

@router.get("/tanques")
async def listar_tanques(page: int = Query(1, ge=1), limit: int = Query(50, ge=1, le=500), db: AsyncSession = Depends(get_db), _=CanView):
    q = select(Tanque)
    total_r = await db.execute(select(func.count()).select_from(q.subquery()))
    result = await db.execute(q.offset((page - 1) * limit).limit(limit))
    return {"total": total_r.scalar(), "page": page, "limit": limit, "data": [_serialize(r, Tanque) for r in result.scalars().all()]}

@router.get("/tanques/{item_id}")
async def obtener_tanque(item_id: int, db: AsyncSession = Depends(get_db), _=CanView):
    r = await db.execute(select(Tanque).where(Tanque.id == item_id))
    obj = r.scalar_one_or_none()
    if not obj: raise HTTPException(404, "Tanque no encontrado"); return _serialize(obj, Tanque)

@router.post("/tanques", status_code=201)
async def crear_tanque(data: TanqueCreate, db: AsyncSession = Depends(get_db), _=CanEdit):
    obj = Tanque(**data.model_dump(exclude={"geom"}), geom=geojson_to_geom(data.geom.model_dump()))
    db.add(obj); await db.commit(); await db.refresh(obj); return _serialize(obj, Tanque)

@router.put("/tanques/{item_id}")
async def actualizar_tanque(item_id: int, data: TanqueUpdate, db: AsyncSession = Depends(get_db), _=CanEdit):
    r = await db.execute(select(Tanque).where(Tanque.id == item_id))
    obj = r.scalar_one_or_none()
    if not obj: raise HTTPException(404, "Tanque no encontrado")
    ud = data.model_dump(exclude_none=True)
    if "geom" in ud: obj.geom = geojson_to_geom(ud.pop("geom"))
    for k, v in ud.items(): setattr(obj, k, v)
    await db.commit(); await db.refresh(obj); return _serialize(obj, Tanque)

@router.delete("/tanques/{item_id}", status_code=204)
async def eliminar_tanque(item_id: int, db: AsyncSession = Depends(get_db), _=Depends(require_role("admin"))):
    r = await db.execute(select(Tanque).where(Tanque.id == item_id))
    obj = r.scalar_one_or_none()
    if not obj: raise HTTPException(404)
    await db.delete(obj); await db.commit()


@router.get("/fuentes/geojson")
async def fuentes_geojson(db: AsyncSession = Depends(get_db), _=CanView):
    result = await db.execute(select(Fuente)); return _as_feature_collection(result.scalars().all())

@router.get("/fuentes")
async def listar_fuentes(page: int = Query(1, ge=1), limit: int = Query(50, ge=1, le=500), db: AsyncSession = Depends(get_db), _=CanView):
    q = select(Fuente)
    total_r = await db.execute(select(func.count()).select_from(q.subquery()))
    result = await db.execute(q.offset((page - 1) * limit).limit(limit))
    return {"total": total_r.scalar(), "page": page, "limit": limit, "data": [_serialize(r, Fuente) for r in result.scalars().all()]}

@router.post("/fuentes", status_code=201)
async def crear_fuente(data: FuenteCreate, db: AsyncSession = Depends(get_db), _=CanEdit):
    obj = Fuente(**data.model_dump(exclude={"geom"}), geom=geojson_to_geom(data.geom.model_dump()))
    db.add(obj); await db.commit(); await db.refresh(obj); return _serialize(obj, Fuente)

@router.put("/fuentes/{item_id}")
async def actualizar_fuente(item_id: int, data: FuenteUpdate, db: AsyncSession = Depends(get_db), _=CanEdit):
    r = await db.execute(select(Fuente).where(Fuente.id == item_id))
    obj = r.scalar_one_or_none()
    if not obj: raise HTTPException(404, "Fuente no encontrada")
    ud = data.model_dump(exclude_none=True)
    if "geom" in ud: obj.geom = geojson_to_geom(ud.pop("geom"))
    for k, v in ud.items(): setattr(obj, k, v)
    await db.commit(); await db.refresh(obj); return _serialize(obj, Fuente)

@router.delete("/fuentes/{item_id}", status_code=204)
async def eliminar_fuente(item_id: int, db: AsyncSession = Depends(get_db), _=Depends(require_role("admin"))):
    r = await db.execute(select(Fuente).where(Fuente.id == item_id))
    obj = r.scalar_one_or_none()
    if not obj: raise HTTPException(404)
    await db.delete(obj); await db.commit()


# ═══════════════════════════════════════════════════════════════
# DAÑOS Y MANTENIMIENTO
# ═══════════════════════════════════════════════════════════════
from app.models.red import Dano
from app.schemas.red import DanoCreate, DanoUpdate, DanoResponse

@router.get("/danos/geojson")
async def danos_geojson(db: AsyncSession = Depends(get_db), _=CanView):
    result = await db.execute(select(Dano)); return _as_feature_collection(result.scalars().all())

@router.get("/danos")
async def listar_danos(page: int = Query(1, ge=1), limit: int = Query(50, ge=1, le=500), db: AsyncSession = Depends(get_db), _=CanView):
    q = select(Dano)
    total_r = await db.execute(select(func.count()).select_from(q.subquery()))
    result = await db.execute(q.offset((page - 1) * limit).limit(limit))
    return {"total": total_r.scalar(), "page": page, "limit": limit, "data": [_serialize(r, Dano) for r in result.scalars().all()]}

@router.get("/danos/{item_id}")
async def obtener_dano(item_id: int, db: AsyncSession = Depends(get_db), _=CanView):
    r = await db.execute(select(Dano).where(Dano.id == item_id))
    obj = r.scalar_one_or_none()
    if not obj: raise HTTPException(404, "Daño no encontrado"); return _serialize(obj, Dano)

@router.post("/danos", status_code=201)
async def crear_dano(data: DanoCreate, db: AsyncSession = Depends(get_db), current_user=CanEdit):
    obj = Dano(**data.model_dump(exclude={"geom"}), geom=geojson_to_geom(data.geom.model_dump()))
    obj.usuario_id = current_user.id
    db.add(obj); await db.commit(); await db.refresh(obj); return _serialize(obj, Dano)

@router.put("/danos/{item_id}")
async def actualizar_dano(item_id: int, data: DanoUpdate, db: AsyncSession = Depends(get_db), _=CanEdit):
    r = await db.execute(select(Dano).where(Dano.id == item_id))
    obj = r.scalar_one_or_none()
    if not obj: raise HTTPException(404, "Daño no encontrado")
    ud = data.model_dump(exclude_none=True)
    if "geom" in ud: obj.geom = geojson_to_geom(ud.pop("geom"))
    for k, v in ud.items(): setattr(obj, k, v)
    await db.commit(); await db.refresh(obj); return _serialize(obj, Dano)

@router.delete("/danos/{item_id}", status_code=204)
async def eliminar_dano(item_id: int, db: AsyncSession = Depends(get_db), _=Depends(require_role("admin"))):
    r = await db.execute(select(Dano).where(Dano.id == item_id))
    obj = r.scalar_one_or_none()
    if not obj: raise HTTPException(404)
    await db.delete(obj); await db.commit()


# ═══════════════════════════════════════════════════════════════
# ESTADÍSTICAS GENERALES DE LA RED
# ═══════════════════════════════════════════════════════════════
@router.get("/red/stats")
async def stats_red(db: AsyncSession = Depends(get_db), _=CanView):
    """Conteos totales y por estado para el dashboard."""
    async def count(model): return (await db.execute(select(func.count()).select_from(model))).scalar()

    return {
        "tuberias": await count(Tuberia),
        "nodos":    await count(Nodo),
        "valvulas": await count(Valvula),
        "tanques":  await count(Tanque),
        "fuentes":  await count(Fuente),
    }
