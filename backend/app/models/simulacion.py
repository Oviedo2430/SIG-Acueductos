"""
Modelo SQLAlchemy para simulaciones hidráulicas.
Esquema: hidraulica
"""
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, JSON
from sqlalchemy.sql import func
from app.database import Base


class Simulacion(Base):
    __tablename__ = "simulaciones"
    __table_args__ = {"schema": "hidraulica"}

    id          = Column(Integer, primary_key=True, index=True)
    nombre      = Column(String(100), nullable=False)
    descripcion = Column(String(500))

    # Estado: pendiente | ejecutando | completada | error
    estado = Column(String(20), nullable=False, default="pendiente")

    # Configuración
    duracion_horas   = Column(Float, default=24.0)
    paso_tiempo_min  = Column(Integer, default=60)
    factor_demanda   = Column(Float, default=1.0)
    modo_simulacion  = Column(String(20), default="estacionaria")  # estacionaria | periodo_extendido

    # Resultados (JSON compacto)
    resultados_nodos    = Column(JSON)   # {codigo: {presion_mca, cota_piez}}
    resultados_tuberias = Column(JSON)   # {codigo: {velocidad_ms, caudal_lps, perdida_m_km}}

    # Estadísticas rápidas para el dashboard
    presion_min_mca   = Column(Float)
    presion_max_mca   = Column(Float)
    presion_media_mca = Column(Float)
    nodos_criticos    = Column(Integer, default=0)   # presión < 10 m.c.a
    nodos_total       = Column(Integer, default=0)
    tuberias_total    = Column(Integer, default=0)

    mensaje_error = Column(String(1000))

    fecha_creacion          = Column(DateTime(timezone=True), server_default=func.now())
    fecha_inicio_ejecucion  = Column(DateTime(timezone=True))
    fecha_fin_ejecucion     = Column(DateTime(timezone=True))
    duracion_calculo_seg    = Column(Float)

    usuario_id = Column(Integer, ForeignKey("auth.usuarios.id", ondelete="SET NULL"), nullable=True)
