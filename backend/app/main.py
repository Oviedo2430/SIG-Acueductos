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
        from sqlalchemy import text
        
        # Verificar y corregir esquema de simulaciones si es la versión vieja de init.sql
        res = await conn.execute(text("""
            SELECT column_name FROM information_schema.columns 
            WHERE table_schema='hidraulica' AND table_name='simulaciones' AND column_name='tipo'
        """))
        if not res.fetchone():
            print("⚠️ Detectado esquema obsoleto de hidraulica.simulaciones. Recreando tablas...")
            await conn.execute(text("DROP TABLE IF EXISTS hidraulica.resultados_nodo CASCADE;"))
            await conn.execute(text("DROP TABLE IF EXISTS hidraulica.resultados_tuberia CASCADE;"))
            await conn.execute(text("DROP TABLE IF EXISTS hidraulica.simulaciones CASCADE;"))
            
        # Añadir hab_por_vivienda a lecturas_macromedidor si no existe
        try:
            await conn.execute(text("ALTER TABLE gis.lecturas_macromedidor ADD COLUMN IF NOT EXISTS hab_por_vivienda FLOAT DEFAULT 2.87;"))
            await conn.execute(text("ALTER TABLE gis.valvulas ADD COLUMN IF NOT EXISTS nodo_inicio VARCHAR(50);"))
            await conn.execute(text("ALTER TABLE gis.valvulas ADD COLUMN IF NOT EXISTS nodo_fin VARCHAR(50);"))
            await conn.execute(text("ALTER TABLE hidraulica.simulaciones ADD COLUMN IF NOT EXISTS pct_cumplimiento_ras FLOAT DEFAULT 100.0;"))
            await conn.execute(text("ALTER TABLE hidraulica.simulaciones ADD COLUMN IF NOT EXISTS cumple_art61 BOOLEAN DEFAULT TRUE;"))
            await conn.execute(text("ALTER TABLE hidraulica.simulaciones ADD COLUMN IF NOT EXISTS cumple_art62 BOOLEAN DEFAULT TRUE;"))
        except Exception:
            pass # Si la tabla no existe aún, se creará en el create_all

            
        # Crear tablas que falten según SQLAlchemy Models
        from app.database import Base
        await conn.run_sync(Base.metadata.create_all)
        
        await conn.execute(text("SELECT 1"))
    print("✅ Conexión a base de datos verificada y esquema actualizado.")

    # Seed de usuarios iniciales
    await _seed_admin_user()
    await _seed_operador_user()

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
                    INSERT INTO auth.usuarios (email, hashed_password, nombre_completo, rol, activo)
                    VALUES (:email, :pwd, 'Administrador Principal', 'admin', true)
                    ON CONFLICT (email) DO UPDATE SET hashed_password = :pwd
                """),
                {"pwd": hashed, "email": settings.INITIAL_ADMIN_EMAIL}
            )
            await db.commit()
            print(f"🔑 Contraseña del admin inicial configurada: {settings.INITIAL_ADMIN_EMAIL}")
        else:
            print("ℹ️  Usuario admin ya existe, sin cambios.")


async def _seed_operador_user():
    """Crea el usuario operador inicial si no existe (H-06)."""
    from app.database import AsyncSessionLocal
    from app.auth.utils import get_password_hash
    from sqlalchemy import text

    async with AsyncSessionLocal() as db:
        res = await db.execute(
            text("SELECT id FROM auth.usuarios WHERE email = 'operador@acueducto.gov.co'")
        )
        if not res.fetchone():
            hashed = get_password_hash("Operador2026")
            await db.execute(
                text("""
                    INSERT INTO auth.usuarios (email, hashed_password, nombre_completo, rol, activo)
                    VALUES ('operador@acueducto.gov.co', :pwd, 'Operador SISCATAGUA', 'operador', true)
                    ON CONFLICT (email) DO NOTHING
                """),
                {"pwd": hashed}
            )
            await db.commit()
            print("🔑 Usuario operador inicial configurado: operador@acueducto.gov.co")


# ──────────────────────────────────────────────
# Instancia de la aplicación
# ──────────────────────────────────────────────
is_prod = getattr(settings, "ENVIRONMENT", "").lower() == "production"

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.PROJECT_VERSION,
    description="API para el Sistema de Información Geográfica del Acueducto de Labateca",
    docs_url=None if is_prod else "/docs",
    redoc_url=None if is_prod else "/redoc",
    openapi_url=None if is_prod else "/openapi.json",
    lifespan=lifespan,
)

# ── Middlewares ─────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.origins_list,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(GZipMiddleware, minimum_size=1000)


# ── Routers ─────────────────────────────────────
from app.auth.router import router as auth_router
from app.routers.usuarios import router as usuarios_router
from app.routers.red import router as red_router
from app.routers.importacion import router as importacion_router
from app.routers.simulacion import router as simulacion_router
from app.routers.reportes import router as reportes_router
from app.routers.perdidas import router as perdidas_router

app.include_router(auth_router,        prefix=settings.API_V1_PREFIX)
app.include_router(usuarios_router,    prefix=settings.API_V1_PREFIX)
app.include_router(red_router,         prefix=settings.API_V1_PREFIX)
app.include_router(importacion_router, prefix=settings.API_V1_PREFIX)
app.include_router(simulacion_router,  prefix=settings.API_V1_PREFIX)
app.include_router(reportes_router,    prefix=settings.API_V1_PREFIX)
app.include_router(perdidas_router,    prefix=settings.API_V1_PREFIX)


# ── Health check ────────────────────────────────
@app.get("/health", tags=["Sistema"])
async def health_check():
    """Endpoint de estado del servidor (usado por EasyPanel para health checks)."""
    return {
        "status": "ok",
        "service": settings.PROJECT_NAME,
        "version": settings.PROJECT_VERSION,
    }


@app.get(f"{settings.API_V1_PREFIX}/config/normativa", tags=["Configuración"])
async def get_normativa_config():
    """Retorna los parámetros oficiales de la Res. 0330/2017 y 0799/2021 (Arts. 61 y 62)."""
    from app.core.normativa import CRITERIOS_DEFAULT
    return CRITERIOS_DEFAULT.model_dump()


@app.get("/", tags=["Sistema"])
async def root():
    return {
        "message": f"Bienvenido a la API del {settings.PROJECT_NAME}",
        "docs": None if is_prod else "/docs",
    }

