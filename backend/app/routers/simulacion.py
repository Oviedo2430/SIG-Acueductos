"""
Router de modelado hidráulico con WNTR.
"""
import time
from datetime import datetime, timezone
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.auth.dependencies import get_current_user, require_role
from app.models.simulacion import Simulacion
from app.schemas.simulacion import SimulacionConfig, SimulacionResponse, SimulacionDetalleResponse
from app.services import wntr_service
from app.models.usuarios import Usuario

router = APIRouter(prefix="/simulacion", tags=["Modelado hidráulico"])

CanRun  = Depends(require_role("admin", "operador"))
CanView = Depends(get_current_user)


@router.post("", response_model=SimulacionDetalleResponse, status_code=201)
async def crear_y_ejecutar_simulacion(
    config: SimulacionConfig,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(require_role("admin", "operador")),
):
    """
    Crea y ejecuta una simulación hidráulica con WNTR.
    Si no hay datos en la BD, usa la red de demostración de Labateca.
    """
    # Crear registro de simulación
    sim = Simulacion(
        nombre=config.nombre,
        descripcion=config.descripcion,
        estado="ejecutando",
        duracion_horas=config.duracion_horas,
        paso_tiempo_min=config.paso_tiempo_min,
        factor_demanda=config.factor_demanda,
        modo_simulacion=config.modo_simulacion,
        usuario_id=current_user.id,
        fecha_inicio_ejecucion=datetime.now(timezone.utc),
    )
    db.add(sim)
    await db.commit()
    await db.refresh(sim)

    t_start = time.perf_counter()
    try:
        result = await wntr_service.ejecutar_simulacion(db, config.model_dump())

        stats = result["stats"]
        sim.estado               = "completada"
        sim.resultados_nodos     = result["node_results"]
        sim.resultados_tuberias  = result["pipe_results"]
        sim.presion_min_mca      = stats["presion_min"]
        sim.presion_max_mca      = stats["presion_max"]
        sim.presion_media_mca    = stats["presion_media"]
        sim.nodos_criticos       = stats["nodos_criticos"]
        sim.nodos_total          = stats["nodos_total"]
        sim.tuberias_total       = stats["tuberias_total"]
        sim.fecha_fin_ejecucion  = datetime.now(timezone.utc)
        sim.duracion_calculo_seg = round(time.perf_counter() - t_start, 2)

        if result.get("es_demo"):
            sim.descripcion = (sim.descripcion or "") + " [Red de demostración — sin datos reales importados]"

    except Exception as e:
        sim.estado        = "error"
        sim.mensaje_error = str(e)[:900]
        sim.fecha_fin_ejecucion = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(sim)
    return sim


@router.get("", response_model=List[SimulacionResponse])
async def listar_simulaciones(
    db: AsyncSession = Depends(get_db),
    _=CanView,
):
    """Lista todas las simulaciones (sin resultados detallados)."""
    result = await db.execute(select(Simulacion).order_by(Simulacion.fecha_creacion.desc()))
    return result.scalars().all()


@router.get("/{sim_id}", response_model=SimulacionDetalleResponse)
async def obtener_simulacion(
    sim_id: int,
    db: AsyncSession = Depends(get_db),
    _=CanView,
):
    """Retorna una simulación con todos sus resultados (nodos + tuberías)."""
    result = await db.execute(select(Simulacion).where(Simulacion.id == sim_id))
    sim = result.scalar_one_or_none()
    if not sim:
        raise HTTPException(404, "Simulación no encontrada")
    return sim


@router.delete("/{sim_id}", status_code=204)
async def eliminar_simulacion(
    sim_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_role("admin")),
):
    result = await db.execute(select(Simulacion).where(Simulacion.id == sim_id))
    sim = result.scalar_one_or_none()
    if not sim:
        raise HTTPException(404, "Simulación no encontrada")
    await db.delete(sim)
    await db.commit()


@router.get("/{sim_id}/exportar-inp")
async def exportar_inp(
    sim_id: int,
    db: AsyncSession = Depends(get_db),
    _=CanView,
):
    """
    Exporta la red en formato EPANET .INP para uso externo.
    (Pendiente Fase 5.2 — requiere serialización completa de la red)
    """
    raise HTTPException(501, "Exportación EPANET .INP disponible en Fase 5.2")
