"""
Router de autenticación: login, refresh, me, logout.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from datetime import datetime, timezone

from app.database import get_db
from app.models.usuarios import Usuario
from app.schemas.usuarios import LoginRequest, TokenResponse, UsuarioResponse
from app.auth.utils import verify_password, create_access_token, create_refresh_token, decode_token
from app.auth.dependencies import get_current_user

router = APIRouter(prefix="/auth", tags=["Autenticación"])


@router.post("/login", response_model=TokenResponse)
async def login(data: LoginRequest, db: AsyncSession = Depends(get_db)):
    """
    Autentica al usuario con email y contraseña.
    Retorna JWT de acceso + datos del usuario.
    """
    result = await db.execute(select(Usuario).where(Usuario.email == data.email))
    user: Usuario = result.scalar_one_or_none()

    if not user or not verify_password(data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Correo o contraseña incorrectos",
        )

    if not user.activo:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Usuario inactivo. Contacte al administrador del sistema.",
        )

    # Registrar último acceso
    await db.execute(
        update(Usuario)
        .where(Usuario.id == user.id)
        .values(ultimo_acceso=datetime.now(timezone.utc))
    )
    await db.commit()
    await db.refresh(user)

    token = create_access_token({"sub": user.email, "rol": user.rol, "uid": user.id})
    return TokenResponse(
        access_token=token,
        user=UsuarioResponse.model_validate(user),
    )


@router.get("/me", response_model=UsuarioResponse)
async def get_me(current_user: Usuario = Depends(get_current_user)):
    """Retorna los datos del usuario autenticado."""
    return current_user


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(
    body: dict,
    db: AsyncSession = Depends(get_db),
):
    """
    Genera un nuevo access token usando el refresh token.
    Body: { "refresh_token": "..." }
    """
    token = body.get("refresh_token")
    if not token:
        raise HTTPException(status_code=400, detail="refresh_token requerido")

    payload = decode_token(token)
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Refresh token inválido o expirado")

    email = payload.get("sub")
    result = await db.execute(select(Usuario).where(Usuario.email == email))
    user: Usuario = result.scalar_one_or_none()

    if not user or not user.activo:
        raise HTTPException(status_code=401, detail="Usuario no válido")

    new_token = create_access_token({"sub": user.email, "rol": user.rol, "uid": user.id})
    return TokenResponse(access_token=new_token, user=UsuarioResponse.model_validate(user))
