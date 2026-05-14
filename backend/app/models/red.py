"""
Modelos SQLAlchemy para las capas GIS de la red de acueducto.
Esquema: gis (PostgreSQL + PostGIS)
"""
from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, ForeignKey
from sqlalchemy.sql import func
from geoalchemy2 import Geometry
from app.database import Base


class _AuditMixin:
    """Campos comunes de auditoría."""
    fecha_registro      = Column(DateTime(timezone=True), server_default=func.now())
    fecha_actualizacion = Column(DateTime(timezone=True), onupdate=func.now())
    usuario_id          = Column(Integer, ForeignKey("auth.usuarios.id", ondelete="SET NULL"), nullable=True)


class Tuberia(_AuditMixin, Base):
    """Tramo de tubería (geometría lineal)."""
    __tablename__ = "tuberias"
    __table_args__ = {"schema": "gis"}

    id              = Column(Integer, primary_key=True, index=True)
    codigo          = Column(String(20), unique=True, nullable=False, index=True)
    geom            = Column(Geometry("LINESTRING", srid=4326), nullable=False)
    diametro_mm     = Column(Float, nullable=False)
    material        = Column(String(50))
    rugosidad_hw    = Column(Float, default=130.0)
    year_instalacion = Column(Integer)
    estado          = Column(String(20), default="Bueno")
    presion_max_mca = Column(Float)
    zona_presion    = Column(String(50))
    sector          = Column(String(50))
    observaciones   = Column(String(500))


class Nodo(_AuditMixin, Base):
    """Nodo de unión o conexión (geometría puntual)."""
    __tablename__ = "nodos"
    __table_args__ = {"schema": "gis"}

    id                  = Column(Integer, primary_key=True, index=True)
    codigo              = Column(String(20), unique=True, nullable=False, index=True)
    geom                = Column(Geometry("POINT", srid=4326), nullable=False)
    tipo                = Column(String(30), default="Union")
    cota_msnm           = Column(Float, nullable=False)
    demanda_base_lps    = Column(Float, default=0.0)
    tipo_usuario        = Column(String(30))
    presion_min_req_mca = Column(Float, default=10.0)
    num_usuarios        = Column(Integer, default=0)
    estado              = Column(String(20), default="Activo")
    observaciones       = Column(String(500))


class Valvula(_AuditMixin, Base):
    """Válvula de control (geometría puntual)."""
    __tablename__ = "valvulas"
    __table_args__ = {"schema": "gis"}

    id              = Column(Integer, primary_key=True, index=True)
    codigo          = Column(String(20), unique=True, nullable=False, index=True)
    geom            = Column(Geometry("POINT", srid=4326), nullable=False)
    tipo            = Column(String(10), nullable=False, default="TCV")
    estado          = Column(String(20), default="Abierta")
    diametro_mm     = Column(Float)
    cota_msnm       = Column(Float)
    presion_setting = Column(Float)
    tuberia_id      = Column(Integer, ForeignKey("gis.tuberias.id", ondelete="SET NULL"), nullable=True)
    observaciones   = Column(String(500))


class Tanque(_AuditMixin, Base):
    """Tanque de almacenamiento (geometría puntual)."""
    __tablename__ = "tanques"
    __table_args__ = {"schema": "gis"}

    id              = Column(Integer, primary_key=True, index=True)
    codigo          = Column(String(20), unique=True, nullable=False, index=True)
    geom            = Column(Geometry("POINT", srid=4326), nullable=False)
    nombre          = Column(String(100))
    cota_fondo_msnm = Column(Float, nullable=False)
    cota_techo_msnm = Column(Float, nullable=False)
    nivel_inicial_m = Column(Float)
    nivel_min_m     = Column(Float, default=0.0)
    nivel_max_m     = Column(Float)
    capacidad_m3    = Column(Float)
    diametro_m      = Column(Float)
    material        = Column(String(50))
    estado          = Column(String(20), default="Operativo")
    observaciones   = Column(String(500))


class Fuente(_AuditMixin, Base):
    """Fuente o reservorio (geometría puntual)."""
    __tablename__ = "fuentes"
    __table_args__ = {"schema": "gis"}

    id                      = Column(Integer, primary_key=True, index=True)
    codigo                  = Column(String(20), unique=True, nullable=False, index=True)
    geom                    = Column(Geometry("POINT", srid=4326), nullable=False)
    nombre                  = Column(String(100))
    tipo                    = Column(String(30), default="Bocatoma")
    cota_piezometrica_msnm  = Column(Float, nullable=False)
    caudal_disponible_lps   = Column(Float)
    calidad_agua            = Column(String(50))
    estado                  = Column(String(20), default="Activa")
    observaciones           = Column(String(500))


class Dano(Base):
    """Registro operativo de daños y reparaciones (geometría puntual)."""
    __tablename__ = "danos"
    __table_args__ = {"schema": "gis"}

    id                      = Column(Integer, primary_key=True, index=True)
    codigo                  = Column(String(20), unique=True, nullable=False, index=True)
    geom                    = Column(Geometry("POINT", srid=4326), nullable=False)
    tipo_dano               = Column(String(50), nullable=False)
    severidad               = Column(String(20), default="Media")
    estado_reparacion       = Column(String(30), default="Pendiente")
    costo_reparacion        = Column(Float, default=0.0)
    volumen_perdido_est_m3  = Column(Float, default=0.0)
    observaciones           = Column(String(500))
    
    fecha_reporte           = Column(DateTime(timezone=True), server_default=func.now())
    fecha_reparacion        = Column(DateTime(timezone=True))
    fecha_actualizacion     = Column(DateTime(timezone=True), onupdate=func.now())
    usuario_id              = Column(Integer, ForeignKey("auth.usuarios.id", ondelete="SET NULL"), nullable=True)
