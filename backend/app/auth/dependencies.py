"""
Dependencies de FastAPI para autenticación y control de roles.
Uso:
    current_user = Depends(get_current_user)
    admin_user   = Depends(require_role("admin"))
    op_or_admin  = Depends(require_role("admin", "operador"))
"""
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.auth.utils import decode_token
from app.models.usuarios import Usuario

bearer_scheme = HTTPBearer(auto_error=True)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> Usuario:
    """
    Extrae y valida el JWT del header Authorization.
    Retorna el usuario autenticado o lanza 401.
    """
    token = credentials.credentials
    payload = decode_token(token)

    if not payload or payload.get("type") != "access":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido o expirado",
            headers={"WWW-Authenticate": "Bearer"},
        )

    email: str = payload.get("sub")
    if not email:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token malformado")

    result = await db.execute(select(Usuario).where(Usuario.email == email))
    user: Usuario = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Usuario no encontrado")

    if not user.activo:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Usuario inactivo. Contacte al administrador.")

    return user


def require_role(*roles: str):
    """
    Factory de dependency que valida que el usuario tenga uno de los roles indicados.
    Ejemplo: Depends(require_role("admin", "operador"))
    """
    async def _dependency(current_user: Usuario = Depends(get_current_user)) -> Usuario:
        if current_user.rol not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Acceso denegado. Se requiere rol: {' o '.join(roles)}.",
            )
        return current_user
    return _dependency


# Shortcuts de uso frecuente
get_admin    = require_role("admin")
get_op_admin = require_role("admin", "operador")
get_any_user = get_current_user
