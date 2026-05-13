"""
Schemas Pydantic para usuarios y autenticación.
"""
from pydantic import BaseModel, EmailStr, field_validator
from typing import Optional
from datetime import datetime


ROLES_VALIDOS = ("admin", "operador", "tecnico", "visualizador")


class UsuarioBase(BaseModel):
    email: EmailStr
    nombre_completo: Optional[str] = None
    rol: str = "visualizador"

    @field_validator("rol")
    @classmethod
    def rol_valido(cls, v: str) -> str:
        if v not in ROLES_VALIDOS:
            raise ValueError(f"Rol inválido. Opciones: {', '.join(ROLES_VALIDOS)}")
        return v


class UsuarioCreate(UsuarioBase):
    password: str

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("La contraseña debe tener al menos 8 caracteres")
        return v


class UsuarioUpdate(BaseModel):
    nombre_completo: Optional[str] = None
    rol: Optional[str] = None
    activo: Optional[bool] = None
    password: Optional[str] = None

    @field_validator("rol")
    @classmethod
    def rol_valido(cls, v: Optional[str]) -> Optional[str]:
        if v and v not in ROLES_VALIDOS:
            raise ValueError(f"Rol inválido. Opciones: {', '.join(ROLES_VALIDOS)}")
        return v


class UsuarioResponse(BaseModel):
    id: int
    email: str
    nombre_completo: Optional[str] = None
    rol: str
    activo: bool
    creado_en: Optional[datetime] = None
    ultimo_acceso: Optional[datetime] = None

    model_config = {"from_attributes": True}


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UsuarioResponse
