"""
Conexión y sesión de base de datos.
Usa SQLAlchemy async con GeoAlchemy2 para soporte PostGIS.
"""
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from app.config import get_settings

settings = get_settings()

# Motor async para las operaciones normales de la API
engine = create_async_engine(
    settings.DATABASE_URL,
    echo=False,          # Cambiar a True para debug de SQL
    pool_size=10,
    max_overflow=20,
    pool_pre_ping=True,
)

# Factory de sesiones
AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
    autocommit=False,
)


class Base(DeclarativeBase):
    """Base para todos los modelos SQLAlchemy del proyecto."""
    pass


async def get_db() -> AsyncSession:
    """
    Dependency de FastAPI para inyectar la sesión de BD.
    Uso: db: AsyncSession = Depends(get_db)
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
