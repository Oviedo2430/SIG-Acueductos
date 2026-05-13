"""
Modelo SQLAlchemy para la tabla auth.usuarios
"""
from sqlalchemy import Column, Integer, String, Boolean, DateTime
from sqlalchemy.sql import func
from app.database import Base


class Usuario(Base):
    __tablename__ = "usuarios"
    __table_args__ = {"schema": "auth"}

    id              = Column(Integer, primary_key=True, index=True)
    email           = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    nombre_completo = Column(String(100))
    rol             = Column(String(20), nullable=False, default="visualizador")
    activo          = Column(Boolean, nullable=False, default=True)
    ultimo_acceso   = Column(DateTime(timezone=True), nullable=True)
    creado_en       = Column(DateTime(timezone=True), server_default=func.now())
    actualizado_en  = Column(DateTime(timezone=True), onupdate=func.now())

    ROLES_VALIDOS = ("admin", "operador", "tecnico", "visualizador")
