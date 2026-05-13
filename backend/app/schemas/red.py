"""
Schemas Pydantic para las capas de red.
La geometría se intercambia siempre como dict GeoJSON.
"""
from pydantic import BaseModel, Field
from typing import Optional, Any
from datetime import datetime


# ── Base GeoJSON Feature ─────────────────────────────────────
class GeomInput(BaseModel):
    """Geometría GeoJSON mínima aceptada en POST/PUT."""
    type: str
    coordinates: Any


# ── Tuberías ─────────────────────────────────────────────────
class TuberiaBase(BaseModel):
    codigo: str = Field(..., max_length=20)
    diametro_mm: float = Field(..., gt=0)
    material: Optional[str] = None
    rugosidad_hw: Optional[float] = 130.0
    year_instalacion: Optional[int] = None
    estado: Optional[str] = "Bueno"
    presion_max_mca: Optional[float] = None
    zona_presion: Optional[str] = None
    sector: Optional[str] = None
    observaciones: Optional[str] = None

class TuberiaCreate(TuberiaBase):
    geom: GeomInput

class TuberiaUpdate(BaseModel):
    diametro_mm: Optional[float] = None
    material: Optional[str] = None
    rugosidad_hw: Optional[float] = None
    year_instalacion: Optional[int] = None
    estado: Optional[str] = None
    presion_max_mca: Optional[float] = None
    zona_presion: Optional[str] = None
    sector: Optional[str] = None
    observaciones: Optional[str] = None
    geom: Optional[GeomInput] = None

class TuberiaResponse(TuberiaBase):
    id: int
    geom: Optional[dict] = None
    fecha_registro: Optional[datetime] = None
    fecha_actualizacion: Optional[datetime] = None
    model_config = {"from_attributes": True}


# ── Nodos ─────────────────────────────────────────────────────
class NodoBase(BaseModel):
    codigo: str = Field(..., max_length=20)
    tipo: Optional[str] = "Union"
    cota_msnm: float
    demanda_base_lps: Optional[float] = 0.0
    tipo_usuario: Optional[str] = None
    presion_min_req_mca: Optional[float] = 10.0
    num_usuarios: Optional[int] = 0
    estado: Optional[str] = "Activo"
    observaciones: Optional[str] = None

class NodoCreate(NodoBase):
    geom: GeomInput

class NodoUpdate(BaseModel):
    tipo: Optional[str] = None
    cota_msnm: Optional[float] = None
    demanda_base_lps: Optional[float] = None
    tipo_usuario: Optional[str] = None
    presion_min_req_mca: Optional[float] = None
    num_usuarios: Optional[int] = None
    estado: Optional[str] = None
    observaciones: Optional[str] = None
    geom: Optional[GeomInput] = None

class NodoResponse(NodoBase):
    id: int
    geom: Optional[dict] = None
    fecha_registro: Optional[datetime] = None
    model_config = {"from_attributes": True}


# ── Válvulas ──────────────────────────────────────────────────
class ValvulaBase(BaseModel):
    codigo: str = Field(..., max_length=20)
    tipo: str = "TCV"
    estado: Optional[str] = "Abierta"
    diametro_mm: Optional[float] = None
    cota_msnm: Optional[float] = None
    presion_setting: Optional[float] = None
    observaciones: Optional[str] = None

class ValvulaCreate(ValvulaBase):
    geom: GeomInput

class ValvulaUpdate(BaseModel):
    tipo: Optional[str] = None
    estado: Optional[str] = None
    diametro_mm: Optional[float] = None
    cota_msnm: Optional[float] = None
    presion_setting: Optional[float] = None
    observaciones: Optional[str] = None
    geom: Optional[GeomInput] = None

class ValvulaResponse(ValvulaBase):
    id: int
    geom: Optional[dict] = None
    fecha_registro: Optional[datetime] = None
    model_config = {"from_attributes": True}


# ── Tanques ───────────────────────────────────────────────────
class TanqueBase(BaseModel):
    codigo: str = Field(..., max_length=20)
    nombre: Optional[str] = None
    cota_fondo_msnm: float
    cota_techo_msnm: float
    nivel_inicial_m: Optional[float] = None
    nivel_min_m: Optional[float] = 0.0
    nivel_max_m: Optional[float] = None
    capacidad_m3: Optional[float] = None
    diametro_m: Optional[float] = None
    material: Optional[str] = None
    estado: Optional[str] = "Operativo"
    observaciones: Optional[str] = None

class TanqueCreate(TanqueBase):
    geom: GeomInput

class TanqueUpdate(BaseModel):
    nombre: Optional[str] = None
    cota_fondo_msnm: Optional[float] = None
    cota_techo_msnm: Optional[float] = None
    nivel_inicial_m: Optional[float] = None
    nivel_min_m: Optional[float] = None
    nivel_max_m: Optional[float] = None
    capacidad_m3: Optional[float] = None
    diametro_m: Optional[float] = None
    material: Optional[str] = None
    estado: Optional[str] = None
    observaciones: Optional[str] = None
    geom: Optional[GeomInput] = None

class TanqueResponse(TanqueBase):
    id: int
    geom: Optional[dict] = None
    fecha_registro: Optional[datetime] = None
    model_config = {"from_attributes": True}


# ── Fuentes ───────────────────────────────────────────────────
class FuenteBase(BaseModel):
    codigo: str = Field(..., max_length=20)
    nombre: Optional[str] = None
    tipo: Optional[str] = "Bocatoma"
    cota_piezometrica_msnm: float
    caudal_disponible_lps: Optional[float] = None
    calidad_agua: Optional[str] = None
    estado: Optional[str] = "Activa"
    observaciones: Optional[str] = None

class FuenteCreate(FuenteBase):
    geom: GeomInput

class FuenteUpdate(BaseModel):
    nombre: Optional[str] = None
    tipo: Optional[str] = None
    cota_piezometrica_msnm: Optional[float] = None
    caudal_disponible_lps: Optional[float] = None
    calidad_agua: Optional[str] = None
    estado: Optional[str] = None
    observaciones: Optional[str] = None
    geom: Optional[GeomInput] = None

class FuenteResponse(FuenteBase):
    id: int
    geom: Optional[dict] = None
    fecha_registro: Optional[datetime] = None
    model_config = {"from_attributes": True}


# ── Paginación ────────────────────────────────────────────────
class PaginatedResponse(BaseModel):
    total: int
    page: int
    limit: int
    data: list
