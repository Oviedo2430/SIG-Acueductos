from pydantic import BaseModel, Field
from typing import Optional, Any
from datetime import datetime


class SimulacionConfig(BaseModel):
    nombre: str = Field(..., min_length=1, max_length=100)
    descripcion: Optional[str] = None
    duracion_horas: float = Field(24.0, ge=0.5, le=168.0)
    paso_tiempo_min: int = Field(60, ge=5, le=360)
    factor_demanda: float = Field(1.0, ge=0.1, le=5.0)
    modo_simulacion: str = "estacionaria"  # estacionaria | periodo_extendido


class SimulacionResponse(BaseModel):
    id: int
    nombre: str
    descripcion: Optional[str] = None
    estado: str
    duracion_horas: float
    paso_tiempo_min: int
    factor_demanda: float
    modo_simulacion: str
    presion_min_mca: Optional[float] = None
    presion_max_mca: Optional[float] = None
    presion_media_mca: Optional[float] = None
    nodos_criticos: Optional[int] = None
    nodos_total: Optional[int] = None
    tuberias_total: Optional[int] = None
    mensaje_error: Optional[str] = None
    fecha_creacion: Optional[datetime] = None
    fecha_fin_ejecucion: Optional[datetime] = None
    duracion_calculo_seg: Optional[float] = None
    model_config = {"from_attributes": True}


class SimulacionDetalleResponse(SimulacionResponse):
    resultados_nodos: Optional[Any] = None
    resultados_tuberias: Optional[Any] = None
