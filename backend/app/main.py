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
    - Inicio: asegura esquemas, crea tablas, aplica migraciones seguras y crea usuarios iniciales.
    - Cierre: cierra el pool de conexiones.
    """
    # Startup
    print(f"🚀 Iniciando {settings.PROJECT_NAME} v{settings.PROJECT_VERSION}")
    
    # 1. Asegurar esquemas y tablas base
    try:
        async with engine.begin() as conn:
            from sqlalchemy import text
            await conn.execute(text("CREATE SCHEMA IF NOT EXISTS auth;"))
            await conn.execute(text("CREATE SCHEMA IF NOT EXISTS gis;"))
            await conn.execute(text("CREATE SCHEMA IF NOT EXISTS hidraulica;"))
            
            # Verificar si existe el esquema viejo con columna 'tipo' (de init.sql anterior)
            res = await conn.execute(text("""
                SELECT column_name FROM information_schema.columns 
                WHERE table_schema='hidraulica' AND table_name='simulaciones' AND column_name='tipo'
            """))
            if res.fetchone():
                print("⚠️ Detectado esquema obsoleto de hidraulica.simulaciones con columna 'tipo'. Recreando...")
                await conn.execute(text("DROP TABLE IF EXISTS hidraulica.resultados_nodo CASCADE;"))
                await conn.execute(text("DROP TABLE IF EXISTS hidraulica.resultados_tuberia CASCADE;"))
                await conn.execute(text("DROP TABLE IF EXISTS hidraulica.simulaciones CASCADE;"))

            # Crear todas las tablas que falten según los modelos SQLAlchemy
            from app.database import Base
            await conn.run_sync(Base.metadata.create_all)
            print("✅ Tablas base verificadas/creadas correctamente.")
    except Exception as e:
        print(f"⚠️ Advertencia inicializando esquemas base: {e}")

    # 2. Migraciones incrementales de columnas (cada una en su propia transacción protegida e idempotente)
    column_migrations = [
        ("gis", "lecturas_macromedidor", "hab_por_vivienda", "FLOAT DEFAULT 2.87"),
        ("gis", "valvulas", "nodo_inicio", "VARCHAR(50)"),
        ("gis", "valvulas", "nodo_fin", "VARCHAR(50)"),
        ("hidraulica", "simulaciones", "pct_cumplimiento_ras", "FLOAT DEFAULT 100.0"),
        ("hidraulica", "simulaciones", "cumple_art61", "BOOLEAN DEFAULT TRUE"),
        ("hidraulica", "simulaciones", "cumple_art62", "BOOLEAN DEFAULT TRUE"),
    ]
    for schema, table, col, col_def in column_migrations:
        try:
            async with engine.begin() as conn:
                from sqlalchemy import text
                await conn.execute(text(f"""
                    DO $$ 
                    BEGIN 
                        IF EXISTS (
                            SELECT 1 FROM information_schema.tables 
                            WHERE table_schema = '{schema}' AND table_name = '{table}'
                        ) AND NOT EXISTS (
                            SELECT 1 FROM information_schema.columns 
                            WHERE table_schema = '{schema}' AND table_name = '{table}' AND column_name = '{col}'
                        ) THEN 
                            ALTER TABLE {schema}.{table} ADD COLUMN {col} {col_def}; 
                        END IF; 
                    END $$;
                """))
        except Exception as e:
            print(f"ℹ️ Migración omitida ({schema}.{table}.{col}): {e}")

    # 3. Seed de usuarios iniciales
    try:
        await _seed_admin_user()
    except Exception as e:
        print(f"⚠️ Error en seed_admin: {e}")

    try:
        await _seed_operador_user()
    except Exception as e:
        print(f"⚠️ Error en seed_operador: {e}")

    print("✅ Servidor listo para recibir peticiones.")
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
@app.get(f"{settings.API_V1_PREFIX}/health", tags=["Sistema"])
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

