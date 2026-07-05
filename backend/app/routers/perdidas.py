from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from typing import List

from app.database import get_db
from app.auth.dependencies import require_role, get_current_active_user
from app.models.red import LecturaMacromedidor, Nodo
from app.schemas.perdidas import LecturaMacromedidorCreate, LecturaMacromedidorResponse
from app.models.usuarios import Usuario

router = APIRouter(prefix="/perdidas", tags=["Control de Pérdidas"])

CanEdit = Depends(require_role(["Admin", "Operador"]))

@router.post("/macromedidor", response_model=LecturaMacromedidorResponse)
async def registrar_lectura(
    req: LecturaMacromedidorCreate,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(get_current_active_user)
):
    # Validar rol manual por seguridad
    if current_user.rol not in ["Admin", "Operador"]:
        raise HTTPException(403, "No tienes permisos para registrar lecturas")

    # 1. Obtener la suma total de usuarios activos en la red
    query = select(func.sum(Nodo.num_usuarios)).where(Nodo.estado == "Activo")
    res = await db.execute(query)
    total_usuarios = res.scalar() or 0

    if total_usuarios == 0:
        raise HTTPException(400, "No hay usuarios registrados en los nodos para calcular el CNA.")

    # 2. Calcular CNA (Consumo Nocturno Autorizado)
    # CNA = (Total Usuarios * factor_cna (L/hab/h)) / 3600 segundos
    cna_lps = (total_usuarios * req.factor_cna) / 3600.0

    # 3. Calcular Fugas (Pérdidas Reales)
    fugas_lps = req.caudal_cm_lps - cna_lps
    if fugas_lps < 0:
        fugas_lps = 0.0 # No puede haber fugas negativas teóricamente

    # 4. Crear registro
    nueva_lectura = LecturaMacromedidor(
        fecha_lectura=req.fecha_lectura,
        caudal_cm_lps=req.caudal_cm_lps,
        factor_cna=req.factor_cna,
        cna_lps=round(cna_lps, 3),
        fugas_lps=round(fugas_lps, 3),
        usuario_id=current_user.id
    )

    db.add(nueva_lectura)
    await db.commit()
    await db.refresh(nueva_lectura)

    return nueva_lectura


@router.get("/macromedidor", response_model=List[LecturaMacromedidorResponse])
async def obtener_historial_lecturas(
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
    _ = Depends(get_current_active_user)
):
    query = select(LecturaMacromedidor).order_by(desc(LecturaMacromedidor.fecha_lectura)).limit(limit)
    res = await db.execute(query)
    return res.scalars().all()


@router.delete("/macromedidor/{id}")
async def eliminar_lectura(
    id: int,
    db: AsyncSession = Depends(get_db),
    _ = Depends(require_role(["Admin"]))
):
    query = select(LecturaMacromedidor).where(LecturaMacromedidor.id == id)
    res = await db.execute(query)
    lectura = res.scalar_one_or_none()
    
    if not lectura:
        raise HTTPException(404, "Lectura no encontrada")
        
    await db.delete(lectura)
    await db.commit()
    return {"mensaje": "Lectura eliminada exitosamente"}
