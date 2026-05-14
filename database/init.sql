-- ============================================================
-- SIG-Acueducto Labateca — Script de inicialización de BD
-- PostgreSQL 15 + PostGIS 3.x
-- Se ejecuta automáticamente al levantar el contenedor de db
-- ============================================================

-- Extensiones requeridas
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS postgis_topology;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- Esquemas
-- ============================================================
CREATE SCHEMA IF NOT EXISTS gis;
CREATE SCHEMA IF NOT EXISTS hidraulica;
CREATE SCHEMA IF NOT EXISTS auth;

-- ============================================================
-- ESQUEMA: auth
-- ============================================================

CREATE TABLE IF NOT EXISTS auth.usuarios (
    id              SERIAL PRIMARY KEY,
    email           VARCHAR(255) UNIQUE NOT NULL,
    hashed_password VARCHAR(255) NOT NULL,
    nombre_completo VARCHAR(100),
    rol             VARCHAR(20) NOT NULL DEFAULT 'visualizador'
                    CHECK (rol IN ('admin', 'operador', 'tecnico', 'visualizador')),
    activo          BOOLEAN NOT NULL DEFAULT TRUE,
    ultimo_acceso   TIMESTAMP WITH TIME ZONE,
    creado_en       TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    actualizado_en  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE auth.usuarios IS 'Usuarios del sistema con roles de acceso diferenciados';

-- ============================================================
-- ESQUEMA: gis — Red de acueducto
-- ============================================================

-- Tuberías (geometría lineal)
CREATE TABLE IF NOT EXISTS gis.tuberias (
    id                  SERIAL PRIMARY KEY,
    codigo              VARCHAR(20) UNIQUE NOT NULL,
    geom                GEOMETRY(LineString, 4326) NOT NULL,
    diametro_mm         FLOAT NOT NULL,
    material            VARCHAR(50),   -- PVC, AC, HF, PE, Asbesto-Cemento
    longitud_m          FLOAT GENERATED ALWAYS AS (ST_Length(geom::geography)) STORED,
    rugosidad_hw        FLOAT DEFAULT 130,  -- Coeficiente Hazen-Williams
    year_instalacion    INTEGER,
    estado              VARCHAR(20) DEFAULT 'Bueno'
                        CHECK (estado IN ('Bueno', 'Regular', 'Malo', 'Critico', 'Desconocido')),
    presion_max_mca     FLOAT,
    zona_presion        VARCHAR(50),
    sector              VARCHAR(50),
    observaciones       TEXT,
    fecha_registro      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    fecha_actualizacion TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    usuario_id          INTEGER REFERENCES auth.usuarios(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_tuberias_geom ON gis.tuberias USING GIST(geom);
CREATE INDEX IF NOT EXISTS idx_tuberias_material ON gis.tuberias(material);
CREATE INDEX IF NOT EXISTS idx_tuberias_estado ON gis.tuberias(estado);
COMMENT ON TABLE gis.tuberias IS 'Red de tuberías del sistema de acueducto';

-- Nodos / Uniones (geometría puntual)
CREATE TABLE IF NOT EXISTS gis.nodos (
    id                      SERIAL PRIMARY KEY,
    codigo                  VARCHAR(20) UNIQUE NOT NULL,
    geom                    GEOMETRY(Point, 4326) NOT NULL,
    tipo                    VARCHAR(30) DEFAULT 'Union'
                            CHECK (tipo IN ('Union', 'Tee', 'Codo', 'Conexion', 'Hidrante', 'Otro')),
    cota_msnm               FLOAT NOT NULL,
    demanda_base_lps        FLOAT DEFAULT 0,
    tipo_usuario            VARCHAR(30)
                            CHECK (tipo_usuario IN ('Residencial', 'Comercial', 'Industrial', 'Institucional', 'Mixto', NULL)),
    presion_min_req_mca     FLOAT DEFAULT 10,
    num_usuarios            INTEGER DEFAULT 0,
    estado                  VARCHAR(20) DEFAULT 'Activo'
                            CHECK (estado IN ('Activo', 'Inactivo', 'Desconocido')),
    observaciones           TEXT,
    fecha_registro          TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    fecha_actualizacion     TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    usuario_id              INTEGER REFERENCES auth.usuarios(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_nodos_geom ON gis.nodos USING GIST(geom);
CREATE INDEX IF NOT EXISTS idx_nodos_tipo ON gis.nodos(tipo);
COMMENT ON TABLE gis.nodos IS 'Nodos de unión y conexión de la red de acueducto';

-- Válvulas (geometría puntual)
CREATE TABLE IF NOT EXISTS gis.valvulas (
    id              SERIAL PRIMARY KEY,
    codigo          VARCHAR(20) UNIQUE NOT NULL,
    geom            GEOMETRY(Point, 4326) NOT NULL,
    tipo            VARCHAR(10) NOT NULL DEFAULT 'TCV'
                    CHECK (tipo IN ('PRV', 'TCV', 'GPV', 'FCV', 'PBV', 'CV')),
    estado          VARCHAR(20) DEFAULT 'Abierta'
                    CHECK (estado IN ('Abierta', 'Cerrada', 'Parcial', 'Desconocido')),
    diametro_mm     FLOAT,
    cota_msnm       FLOAT,
    presion_setting FLOAT,       -- Solo para PRV: presión de salida en m.c.a
    tuberia_id      INTEGER REFERENCES gis.tuberias(id) ON DELETE SET NULL,
    observaciones   TEXT,
    fecha_registro          TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    fecha_actualizacion     TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    usuario_id      INTEGER REFERENCES auth.usuarios(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_valvulas_geom ON gis.valvulas USING GIST(geom);
COMMENT ON TABLE gis.valvulas IS 'Válvulas de control de la red (PRV, TCV, GPV, FCV, PBV, CV)';

-- Tanques de almacenamiento (geometría puntual)
CREATE TABLE IF NOT EXISTS gis.tanques (
    id                  SERIAL PRIMARY KEY,
    codigo              VARCHAR(20) UNIQUE NOT NULL,
    geom                GEOMETRY(Point, 4326) NOT NULL,
    nombre              VARCHAR(100),
    cota_fondo_msnm     FLOAT NOT NULL,
    cota_techo_msnm     FLOAT NOT NULL,
    nivel_inicial_m     FLOAT,
    nivel_min_m         FLOAT DEFAULT 0,
    nivel_max_m         FLOAT,
    capacidad_m3        FLOAT,          -- Calculado externamente o manual
    diametro_m          FLOAT,
    material            VARCHAR(50),
    estado              VARCHAR(20) DEFAULT 'Operativo'
                        CHECK (estado IN ('Operativo', 'Fuera de servicio', 'En mantenimiento', 'Desconocido')),
    observaciones       TEXT,
    fecha_registro          TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    fecha_actualizacion     TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    usuario_id          INTEGER REFERENCES auth.usuarios(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_tanques_geom ON gis.tanques USING GIST(geom);
COMMENT ON TABLE gis.tanques IS 'Tanques de almacenamiento del sistema de acueducto';

-- Fuentes / Reservorios (geometría puntual)
CREATE TABLE IF NOT EXISTS gis.fuentes (
    id                          SERIAL PRIMARY KEY,
    codigo                      VARCHAR(20) UNIQUE NOT NULL,
    geom                        GEOMETRY(Point, 4326) NOT NULL,
    nombre                      VARCHAR(100),
    tipo                        VARCHAR(30) DEFAULT 'Bocatoma'
                                CHECK (tipo IN ('Bocatoma', 'Pozo', 'Interconexion', 'Manantial', 'Otro')),
    cota_piezometrica_msnm      FLOAT NOT NULL,
    caudal_disponible_lps       FLOAT,
    calidad_agua                VARCHAR(50),
    estado                      VARCHAR(20) DEFAULT 'Activa'
                                CHECK (estado IN ('Activa', 'Inactiva', 'En mantenimiento')),
    observaciones               TEXT,
    fecha_registro          TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    fecha_actualizacion     TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    usuario_id              INTEGER REFERENCES auth.usuarios(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_fuentes_geom ON gis.fuentes USING GIST(geom);
COMMENT ON TABLE gis.fuentes IS 'Fuentes hídricas y reservorios del sistema';

-- ============================================================
-- ESQUEMA: hidraulica — Simulaciones y resultados
-- ============================================================

CREATE TABLE IF NOT EXISTS hidraulica.simulaciones (
    id              SERIAL PRIMARY KEY,
    nombre          VARCHAR(100) NOT NULL,
    descripcion     TEXT,
    tipo            VARCHAR(20) NOT NULL DEFAULT 'Estatica'
                    CHECK (tipo IN ('Estatica', 'PeriodoExtendido')),
    duracion_h      FLOAT DEFAULT 24,       -- Solo para PeriodoExtendido
    paso_tiempo_h   FLOAT DEFAULT 1,        -- Solo para PeriodoExtendido
    area_geom       GEOMETRY(Polygon, 4326), -- NULL = red completa
    estado          VARCHAR(20) NOT NULL DEFAULT 'Pendiente'
                    CHECK (estado IN ('Pendiente', 'Corriendo', 'Completada', 'Error')),
    mensaje_error   TEXT,
    creado_en       TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completado_en   TIMESTAMP WITH TIME ZONE,
    usuario_id      INTEGER REFERENCES auth.usuarios(id) ON DELETE SET NULL,
    archivo_inp     TEXT                    -- Contenido del .INP generado para WNTR
);

COMMENT ON TABLE hidraulica.simulaciones IS 'Registro de simulaciones hidráulicas ejecutadas';

CREATE TABLE IF NOT EXISTS hidraulica.resultados_nodo (
    id                      SERIAL PRIMARY KEY,
    simulacion_id           INTEGER NOT NULL REFERENCES hidraulica.simulaciones(id) ON DELETE CASCADE,
    nodo_codigo             VARCHAR(20) NOT NULL,
    tiempo_h                FLOAT NOT NULL DEFAULT 0,
    presion_mca             FLOAT,
    carga_hidraulica_msnm   FLOAT,
    demanda_lps             FLOAT
);

CREATE INDEX IF NOT EXISTS idx_res_nodo_sim ON hidraulica.resultados_nodo(simulacion_id);
COMMENT ON TABLE hidraulica.resultados_nodo IS 'Resultados de simulación por nodo';

CREATE TABLE IF NOT EXISTS hidraulica.resultados_tuberia (
    id                          SERIAL PRIMARY KEY,
    simulacion_id               INTEGER NOT NULL REFERENCES hidraulica.simulaciones(id) ON DELETE CASCADE,
    tuberia_codigo              VARCHAR(20) NOT NULL,
    tiempo_h                    FLOAT NOT NULL DEFAULT 0,
    caudal_lps                  FLOAT,
    velocidad_ms                FLOAT,
    perdida_unitaria_m_km       FLOAT,
    estado_reynolds             VARCHAR(20)  -- Laminar, Transicion, Turbulento
);

CREATE INDEX IF NOT EXISTS idx_res_tub_sim ON hidraulica.resultados_tuberia(simulacion_id);
COMMENT ON TABLE hidraulica.resultados_tuberia IS 'Resultados de simulación por tubería';

-- ============================================================
-- Funciones utilitarias
-- ============================================================

-- Actualizar timestamp automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.fecha_actualizacion = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar trigger a todas las tablas con fecha_actualizacion
DO $$ BEGIN
  EXECUTE 'CREATE TRIGGER trg_tuberias_updated BEFORE UPDATE ON gis.tuberias FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()';
  EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  EXECUTE 'CREATE TRIGGER trg_nodos_updated BEFORE UPDATE ON gis.nodos FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()';
  EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  EXECUTE 'CREATE TRIGGER trg_valvulas_updated BEFORE UPDATE ON gis.valvulas FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()';
  EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  EXECUTE 'CREATE TRIGGER trg_tanques_updated BEFORE UPDATE ON gis.tanques FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()';
  EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- Datos iniciales (seed)
-- ============================================================

-- Usuario administrador inicial (contraseña se actualiza via backend al primer inicio)
INSERT INTO auth.usuarios (email, hashed_password, nombre_completo, rol)
VALUES (
    'carlosoviedo24@gmail.com',
    'PLACEHOLDER_REPLACED_BY_BACKEND_ON_STARTUP',
    'Administrador del Sistema',
    'admin'
) ON CONFLICT (email) DO NOTHING;
