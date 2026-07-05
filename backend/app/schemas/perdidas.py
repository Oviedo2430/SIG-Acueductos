from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional

class LecturaMacromedidorBase(BaseModel):
    fecha_lectura: datetime
    caudal_cm_lps: float = Field(..., description="Caudal mínimo nocturno en L/s")
    factor_cna: float = Field(1.5, description="Factor de consumo nocturno L/hab/hora")
    hab_por_vivienda: float = Field(2.87, description="Habitantes promedio por conexión")

class LecturaMacromedidorCreate(LecturaMacromedidorBase):
    pass

class LecturaMacromedidorResponse(LecturaMacromedidorBase):
    id: int
    cna_lps: float
    fugas_lps: float
    fecha_registro: datetime
    usuario_id: Optional[int] = None

    class Config:
        from_attributes = True
