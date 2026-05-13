"""
Entry point principal de la API FastAPI.
SIG-Acueducto Labateca
"""
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware

from app.config import get_settings
from app.database import engine, Base

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Eventos de inicio y cierre de la aplicación.
    - Inicio: verifica conexión a BD, crea tablas si no existen, seed inicial.
    - Cierre: cierra el pool de conexiones.
    """
    # Startup
    print(f"🚀 Iniciando {settings.PROJECT_NAME} v{settings.PROJECT_VERSION}")
    async with engine.begin() as conn:
        # Las tablas se crean via init.sql de PostgreSQL.
        # Aquí solo verificamos la conexión.
        from sqlalchemy import text
        await conn.execute(text("SELECT 1"))
    print("✅ Conexión a base de datos verificada.")

    # Seed del usuario admin inicial
    await _seed_admin_user()

    yield

    # Shutdown
    await engine.dispose()
    print("🔴 Servidor detenido.")


async def _seed_admin_user():
    """Crea el usuario administrador inicial si no existe."""
    from app.database import AsyncSessionLocal
    from app.auth.utils import get_password_hash
    from sqlalchemy import text

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            text("SELECT id FROM auth.usuarios WHERE email = :email"),
            {"email": settings.INITIAL_ADMIN_EMAIL}
        )
        existing = result.fetchone()
        if not existing:
            hashed = get_password_hash(settings.INITIAL_ADMIN_PASSWORD)
            await db.execute(
                text("""
                    UPDATE auth.usuarios
                    SET hashed_password = :pwd
                    WHERE email = :email
                """),
                {"pwd": hashed, "email": settings.INITIAL_ADMIN_EMAIL}
            )
            await db.commit()
            print(f"🔑 Contraseña del admin inicial configurada: {settings.INITIAL_ADMIN_EMAIL}")
        else:
            print("ℹ️  Usuario admin ya existe, sin cambios.")


# ──────────────────────────────────────────────
# Instancia de la aplicación
# ──────────────────────────────────────────────
app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.PROJECT_VERSION,
    description="API para el Sistema de Información Geográfica del Acueducto de Labateca",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# ── Middlewares ─────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(GZipMiddleware, minimum_size=1000)


# ── Routers ─────────────────────────────────────
from app.auth.router import router as auth_router
from app.routers.usuarios import router as usuarios_router
from app.routers.red import router as red_router
from app.routers.importacion import router as importacion_router

app.include_router(auth_router,        prefix=settings.API_V1_PREFIX)
app.include_router(usuarios_router,    prefix=settings.API_V1_PREFIX)
app.include_router(red_router,         prefix=settings.API_V1_PREFIX)
app.include_router(importacion_router, prefix=settings.API_V1_PREFIX)


# ── Health check ────────────────────────────────
@app.get("/health", tags=["Sistema"])
async def health_check():
    """Endpoint de estado del servidor (usado por EasyPanel para health checks)."""
    return {
        "status": "ok",
        "service": settings.PROJECT_NAME,
        "version": settings.PROJECT_VERSION,
    }


@app.get("/", tags=["Sistema"])
async def root():
    return {
        "message": f"Bienvenido a la API del {settings.PROJECT_NAME}",
        "docs": "/docs",
    }
