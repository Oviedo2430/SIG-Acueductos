# ============================================================
# Backend — Dockerfile (multi-stage)
# Stage "development": con hot-reload para desarrollo local
# Stage "production": imagen optimizada para EasyPanel
# ============================================================

# ── Etapa base ──────────────────────────────────────────────
FROM python:3.11-slim AS base

# Dependencias del sistema requeridas por GDAL, PostGIS, WeasyPrint
RUN apt-get update && apt-get install -y --no-install-recommends \
    gdal-bin \
    libgdal-dev \
    libgeos-dev \
    libproj-dev \
    libpango-1.0-0 \
    libpangoft2-1.0-0 \
    libcairo2 \
    libffi-dev \
    gcc \
    g++ \
    curl \
    && rm -rf /var/lib/apt/lists/*

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    GDAL_VERSION=3.6

WORKDIR /app

# ── Etapa de dependencias ───────────────────────────────────
FROM base AS dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# ── Etapa de desarrollo ─────────────────────────────────────
FROM dependencies AS development
# En dev, el código se monta como volumen (ver docker-compose.yml)
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]

# ── Etapa de producción ─────────────────────────────────────
FROM dependencies AS production
COPY . .
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
