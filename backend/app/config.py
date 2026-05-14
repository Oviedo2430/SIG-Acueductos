"""
Configuración central de la aplicación.
Lee variables de entorno desde .env o el entorno del sistema.
"""
from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # Nombre del proyecto
    PROJECT_NAME: str = "SIG-Acueducto Labateca"
    PROJECT_VERSION: str = "1.0.0"
    API_V1_PREFIX: str = "/api/v1"

    # Base de datos
    DATABASE_URL: str
    SYNC_DATABASE_URL: str | None = None

    # JWT
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30

    # CORS
    ALLOWED_ORIGINS: str = "http://localhost:5173"

    # Usuario administrador inicial
    INITIAL_ADMIN_EMAIL: str = "admin@acueducto-labateca.gov.co"
    INITIAL_ADMIN_PASSWORD: str = "Admin123!"

    @property
    def origins_list(self) -> list[str]:
        """Devuelve ALLOWED_ORIGINS como lista de strings."""
        return [o.strip() for o in self.ALLOWED_ORIGINS.split(",")]

    class Config:
        env_file = ".env"
        extra = "ignore"


@lru_cache()
def get_settings() -> Settings:
    """Singleton de configuración (cacheado)."""
    return Settings()
