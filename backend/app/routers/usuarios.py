"""
Router CRUD de usuarios — solo accesible para administradores.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import List, Optional

from app.database import get_db
from app.models.usuarios import Usuario
from app.schemas.usuarios import UsuarioCreate, UsuarioUpdate, UsuarioResponse
from app.auth.dependencies import require_role
from app.auth.utils import get_password_hash

router = APIRouter(prefix="/usuarios", tags=["Usuarios"])

# Solo admins pueden gestionar usuarios
AdminDep = Depends(require_role("admin"))


@router.get("", response_model=List[UsuarioResponse])
async def listar_usuarios(
    activo: Optional[bool] = None,
    rol: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    _=AdminDep,
):
    """Lista todos los usuarios del sistema (solo admin)."""
    q = select(Usuario).order_by(Usuario.creado_en.desc())
    if activo is not None:
        q = q.where(Usuario.activo == activo)
    if rol:
        q = q.where(Usuario.rol == rol)
    result = await db.execute(q)
    return result.scalars().all()


@router.post("", response_model=UsuarioResponse, status_code=status.HTTP_201_CREATED)
async def crear_usuario(
    data: UsuarioCreate,
    db: AsyncSession = Depends(get_db),
    _=AdminDep,
):
    """Crea un nuevo usuario (solo admin)."""
    # Verificar email único
    existing = await db.execute(select(Usuario).where(Usuario.email == data.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail=f"El email '{data.email}' ya está registrado")

    user = Usuario(
        email=data.email,
        hashed_password=get_password_hash(data.password),
        nombre_completo=data.nombre_completo,
        rol=data.rol,
        activo=True,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


@router.get("/{usuario_id}", response_model=UsuarioResponse)
async def obtener_usuario(
    usuario_id: int,
    db: AsyncSession = Depends(get_db),
    _=AdminDep,
):
    result = await db.execute(select(Usuario).where(Usuario.id == usuario_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    return user


@router.put("/{usuario_id}", response_model=UsuarioResponse)
async def actualizar_usuario(
    usuario_id: int,
    data: UsuarioUpdate,
    db: AsyncSession = Depends(get_db),
    _=AdminDep,
):
    """Actualiza datos de un usuario (solo admin)."""
    result = await db.execute(select(Usuario).where(Usuario.id == usuario_id))
    user: Usuario = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    if data.nombre_completo is not None:
        user.nombre_completo = data.nombre_completo
    if data.rol is not None:
        user.rol = data.rol
    if data.activo is not None:
        user.activo = data.activo
    if data.password:
        user.hashed_password = get_password_hash(data.password)

    await db.commit()
    await db.refresh(user)
    return user


@router.delete("/{usuario_id}", status_code=status.HTTP_204_NO_CONTENT)
async def desactivar_usuario(
    usuario_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(require_role("admin")),
):
    """Desactiva un usuario (soft delete). No se puede autodesactivar."""
    if current_user.id == usuario_id:
        raise HTTPException(status_code=400, detail="No puedes desactivar tu propia cuenta")

    result = await db.execute(select(Usuario).where(Usuario.id == usuario_id))
    user: Usuario = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    user.activo = False
    await db.commit()


@router.get("/stats/resumen")
async def resumen_usuarios(
    db: AsyncSession = Depends(get_db),
    _=AdminDep,
):
    """Estadísticas rápidas de usuarios para el panel de admin."""
    total = await db.execute(select(func.count()).select_from(Usuario))
    activos = await db.execute(select(func.count()).select_from(Usuario).where(Usuario.activo == True))
    return {
        "total": total.scalar(),
        "activos": activos.scalar(),
        "inactivos": total.scalar() - activos.scalar(),
    }
