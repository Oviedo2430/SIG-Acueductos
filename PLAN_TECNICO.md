# SIG-Acueducto Labateca — Plan Técnico v1.0
**Última actualización:** 2026-05-13  
**Estado:** En desarrollo — Fase 0 (Planificación completada)  
**Responsable inicial:** Carlos SIG  
**Plataforma de despliegue:** EasyPanel

---

## 1. Descripción del Proyecto

Sistema de Información Geográfica (SIG) web para la gestión integral del sistema de acueducto del casco urbano del municipio de **Labateca, Norte de Santander, Colombia**.

### Objetivos principales
- Visualizar y gestionar la red de acueducto sobre un mapa interactivo
- Permitir la edición del catastro de red (individual y masiva)
- Ejecutar modelado hidráulico de la red completa y por zonas (similar a EPANET)
- Proveer un Dashboard/BI con KPIs, reportes y exportaciones
- Gestionar usuarios con diferentes roles y niveles de acceso
- Desplegarse completamente en EasyPanel como servicio web

### Alcance de la red
- Área: ~50 manzanas del casco urbano de Labateca
- Nodos estimados: 300–600 uniones/nodos de consumo
- Sistema de coordenadas de origen: **SIRGAS CTM-12 (EPSG:9377)**
- Sistema de coordenadas del sistema: **WGS84 (EPSG:4326)** — transformación al importar

---

## 2. Stack Tecnológico

### 2.1 Frontend
| Componente | Tecnología | Versión |
|---|---|---|
| Framework | React + Vite | React 18, Vite 5 |
| Mapa / GIS | MapLibre GL JS | v4.x |
| Edición espacial | MapLibre GL Draw | v1.x |
| Tiles de mapa base | OpenFreeMap (OSM vectorial) | Gratuito, sin API key |
| Gráficas / BI | Apache ECharts | v5.x |
| UI Components | shadcn/ui + Radix UI | latest |
| Tablas de datos | TanStack Table | v8.x |
| Gestión de estado | Zustand | v4.x |
| HTTP Client | TanStack Query + Axios | v5.x |
| Routing | React Router | v6.x |
| Formularios | React Hook Form + Zod | latest |

### 2.2 Backend
| Componente | Tecnología | Versión |
|---|---|---|
| Framework API | FastAPI | v0.111+ |
| Runtime | Python | 3.11+ |
| ORM | SQLAlchemy + GeoAlchemy2 | v2.x |
| Motor hidráulico | WNTR (EPANET wrapper) | v1.x |
| Autenticación | JWT (python-jose + passlib) | — |
| Migraciones BD | Alembic | v1.x |
| Importación SHP | GDAL / Fiona + Shapely | v3.x |
| Exportación Excel | openpyxl | v3.x |
| Exportación PDF | WeasyPrint | v60+ |
| Servidor ASGI | Uvicorn | v0.29+ |

### 2.3 Base de Datos
| Componente | Tecnología | Notas |
|---|---|---|
| Motor principal | PostgreSQL 15+ | Una sola instancia |
| Extensión espacial | PostGIS 3.x | Manejo de geometrías |
| Tile server | Martin (Rust) | Teselas vectoriales desde PostGIS |

### 2.4 Infraestructura (EasyPanel)
```
EasyPanel
├── frontend   → Nginx sirviendo build de React (puerto 80)
├── api        → FastAPI con Uvicorn (puerto 8000)
├── db         → PostgreSQL + PostGIS (puerto 5432, interno)
└── tiles      → Martin tile server (puerto 3000, interno)
```

---

## 3. Arquitectura de la Aplicación

### 3.1 Estructura de directorios del repositorio
```
sig-acueducto-labateca/
├── PLAN_TECNICO.md          ← Este archivo
├── docker-compose.yml       ← Para desarrollo local
├── .env.example
│
├── frontend/                ← Aplicación React
│   ├── src/
│   │   ├── components/
│   │   │   ├── map/
│   │   │   ├── forms/
│   │   │   ├── charts/
│   │   │   └── ui/
│   │   ├── pages/
│   │   │   ├── LoginPage.jsx
│   │   │   ├── MapPage.jsx
│   │   │   ├── CatastroPage.jsx
│   │   │   ├── HidraulicaPage.jsx
│   │   │   ├── DashboardPage.jsx
│   │   │   ├── ReportesPage.jsx
│   │   │   └── AdminPage.jsx
│   │   ├── store/
│   │   ├── hooks/
│   │   ├── services/
│   │   └── lib/
│   ├── Dockerfile
│   └── nginx.conf
│
├── backend/                 ← API FastAPI
│   ├── app/
│   │   ├── main.py
│   │   ├── config.py
│   │   ├── database.py
│   │   ├── auth/
│   │   ├── models/
│   │   │   ├── red.py
│   │   │   ├── usuarios.py
│   │   │   └── simulaciones.py
│   │   ├── schemas/
│   │   ├── routers/
│   │   │   ├── auth.py
│   │   │   ├── tuberias.py
│   │   │   ├── nodos.py
│   │   │   ├── valvulas.py
│   │   │   ├── tanques.py
│   │   │   ├── simulacion.py
│   │   │   ├── importacion.py
│   │   │   └── reportes.py
│   │   └── services/
│   │       ├── hidraulica.py
│   │       ├── importador.py
│   │       └── exportador.py
│   ├── alembic/
│   ├── requirements.txt
│   └── Dockerfile
│
├── database/
│   ├── init.sql
│   └── seeds/
│
└── scripts/
    └── import_shapefiles.py
```

---

## 4. Modelo de Datos

### 4.1 Esquemas de PostgreSQL
```sql
CREATE SCHEMA gis;          -- Datos espaciales
CREATE SCHEMA catastro;     -- Atributos adicionales
CREATE SCHEMA hidraulica;   -- Resultados de simulaciones
CREATE SCHEMA auth;         -- Usuarios y roles
```

### 4.2 Tabla: `gis.tuberias`
```sql
id                  SERIAL PRIMARY KEY
codigo              VARCHAR(20) UNIQUE NOT NULL
geom                GEOMETRY(LineString, 4326)
diametro_mm         FLOAT NOT NULL
material            VARCHAR(50)        -- PVC, AC, HF, PE, Asbesto
longitud_m          FLOAT              -- Calculado de la geometría
rugosidad_hw        FLOAT              -- Coef. Hazen-Williams (C)
año_instalacion     INTEGER
estado              VARCHAR(20)        -- Bueno, Regular, Malo, Critico
presion_max_mca     FLOAT
zona_presion        VARCHAR(50)
sector              VARCHAR(50)
observaciones       TEXT
fecha_registro      TIMESTAMP DEFAULT NOW()
usuario_id          INTEGER REFERENCES auth.usuarios(id)
```

### 4.3 Tabla: `gis.nodos`
```sql
id                  SERIAL PRIMARY KEY
codigo              VARCHAR(20) UNIQUE NOT NULL
geom                GEOMETRY(Point, 4326)
tipo                VARCHAR(30)        -- Union, Tee, Codo, Conexion, Hidrante
cota_msnm           FLOAT NOT NULL
demanda_base_lps    FLOAT
tipo_usuario        VARCHAR(30)        -- Residencial, Comercial, Industrial
presion_min_req_mca FLOAT
num_usuarios        INTEGER
estado              VARCHAR(20)
observaciones       TEXT
```

### 4.4 Tabla: `gis.valvulas`
```sql
id                  SERIAL PRIMARY KEY
codigo              VARCHAR(20) UNIQUE NOT NULL
geom                GEOMETRY(Point, 4326)
tipo                VARCHAR(10)        -- PRV, TCV, GPV, FCV, PBV, CV
estado              VARCHAR(20)        -- Abierta, Cerrada, Parcial
diametro_mm         FLOAT
cota_msnm           FLOAT
presion_setting     FLOAT              -- Para PRV: presión de salida m.c.a
tuberia_id          INTEGER REFERENCES gis.tuberias(id)
observaciones       TEXT
```

### 4.5 Tabla: `gis.tanques`
```sql
id                  SERIAL PRIMARY KEY
codigo              VARCHAR(20) UNIQUE NOT NULL
geom                GEOMETRY(Point, 4326)
nombre              VARCHAR(100)
cota_fondo_msnm     FLOAT
cota_techo_msnm     FLOAT
nivel_inicial_m     FLOAT
nivel_min_m         FLOAT
nivel_max_m         FLOAT
capacidad_m3        FLOAT
diametro_m          FLOAT
material            VARCHAR(50)
estado              VARCHAR(20)
observaciones       TEXT
```

### 4.6 Tabla: `gis.fuentes`
```sql
id                        SERIAL PRIMARY KEY
codigo                    VARCHAR(20) UNIQUE NOT NULL
geom                      GEOMETRY(Point, 4326)
nombre                    VARCHAR(100)
tipo                      VARCHAR(30)    -- Bocatoma, Pozo, Interconexion
cota_piezometrica_msnm    FLOAT
caudal_disponible_lps     FLOAT
observaciones             TEXT
```

### 4.7 Tabla: `hidraulica.simulaciones`
```sql
id              SERIAL PRIMARY KEY
nombre          VARCHAR(100)
descripcion     TEXT
tipo            VARCHAR(20)    -- Estatica, PeriodoExtendido
duracion_h      FLOAT
paso_tiempo_h   FLOAT
estado          VARCHAR(20)    -- Pendiente, Corriendo, Completada, Error
creado_en       TIMESTAMP DEFAULT NOW()
completado_en   TIMESTAMP
usuario_id      INTEGER REFERENCES auth.usuarios(id)
archivo_inp     TEXT           -- Contenido del .INP generado para WNTR
```

### 4.8 Tabla: `hidraulica.resultados_nodo`
```sql
id                      SERIAL PRIMARY KEY
simulacion_id           INTEGER REFERENCES hidraulica.simulaciones(id)
nodo_codigo             VARCHAR(20)
tiempo_h                FLOAT
presion_mca             FLOAT
carga_hidraulica_msnm   FLOAT
demanda_lps             FLOAT
```

### 4.9 Tabla: `hidraulica.resultados_tuberia`
```sql
id                          SERIAL PRIMARY KEY
simulacion_id               INTEGER REFERENCES hidraulica.simulaciones(id)
tuberia_codigo              VARCHAR(20)
tiempo_h                    FLOAT
caudal_lps                  FLOAT
velocidad_ms                FLOAT
perdida_unitaria_m_km       FLOAT
estado_reynolds             VARCHAR(20)    -- Laminar, Transicion, Turbulento
```

### 4.10 Tabla: `auth.usuarios`
```sql
id              SERIAL PRIMARY KEY
email           VARCHAR(255) UNIQUE NOT NULL
hashed_password VARCHAR(255) NOT NULL
nombre_completo VARCHAR(100)
rol             VARCHAR(20)    -- admin, operador, tecnico, visualizador
activo          BOOLEAN DEFAULT TRUE
ultimo_acceso   TIMESTAMP
creado_en       TIMESTAMP DEFAULT NOW()
```

---

## 5. Roles y Permisos

| Rol | Mapa | Catastro | Simulación | Dashboard | Reportes | Admin |
|---|---|---|---|---|---|---|
| **Administrador** | Editar | Full | Full | Sí | Sí | Sí |
| **Operador** | Editar | Full | Ejecutar | Sí | Sí | No |
| **Técnico de Campo** | Ver | Solo actualizar estado | No | Sí | Solo ver | No |
| **Visualizador** | Solo ver | Solo ver | Solo ver resultados | Sí | Descargar | No |

---

## 6. Flujo del Modelado Hidráulico

```
1. Usuario selecciona área (toda la red o zona dibujada en mapa)
2. Frontend → POST /api/simulacion/ejecutar con parámetros
3. Backend consulta PostGIS: obtiene elementos del área seleccionada
4. hidraulica.py construye el modelo WNTR:
   - Añade junctions (nodos) con elevación y demanda
   - Añade pipes (tuberías) con longitud, diámetro, rugosidad Hazen-Williams
   - Añade válvulas, tanques y fuentes/reservorios
5. WNTR ejecuta la simulación (solver EPANET)
6. Resultados se guardan en hidraulica.resultados_*
7. Frontend → GET /api/simulacion/{id}/resultados
8. MapLibre pinta resultados: 
   - Nodos: gradiente verde (OK) → amarillo → rojo (presión crítica)
   - Tuberías: gradiente por velocidad o pérdida de carga
```

---

## 7. Fases de Desarrollo con Checklist

### FASE 1 — Infraestructura y Setup ⬅️ INICIO AQUÍ
- [ ] Crear directorio raíz: `sig-acueducto-labateca/`
- [ ] Crear `docker-compose.yml` para desarrollo local (PostgreSQL+PostGIS, Martin, FastAPI, React)
- [ ] Crear `database/init.sql` con extensiones y esquemas
- [ ] Inicializar proyecto React con Vite en `frontend/`
- [ ] Inicializar proyecto FastAPI en `backend/`
- [ ] Crear Dockerfiles para frontend y backend
- [ ] Crear `.env.example` con todas las variables requeridas
- [ ] Configurar Martin tile server
- [ ] Verificar que todos los servicios levantan localmente

### FASE 2 — Importación de Datos y Visor Base
- [ ] Crear `scripts/import_shapefiles.py`:
  - Leer SHP en EPSG:9377 (SIRGAS CTM-12)
  - Transformar a EPSG:4326 (WGS84)
  - Insertar en tablas `gis.*`
  - Validar geometrías y atributos obligatorios
- [ ] Crear modelos SQLAlchemy + GeoAlchemy2
- [ ] Crear endpoints GET para cada capa
- [ ] Configurar tablas de Martin para servir teselas
- [ ] Implementar visor MapLibre con mapa base OSM (OpenFreeMap)
- [ ] Renderizar capas de la red sobre el mapa
- [ ] Panel lateral de info al hacer clic en elemento

### FASE 3 — Autenticación y Usuarios
- [ ] Endpoint POST /auth/login (retorna access + refresh token)
- [ ] Endpoint POST /auth/refresh
- [ ] Middleware de verificación de roles en FastAPI (Depends)
- [ ] Guards de ruta en React (ProtectedRoute por rol)
- [ ] Página de Login con formulario email/clave
- [ ] Página de administración de usuarios (solo admin)
- [ ] Seed inicial: usuario admin por defecto

### FASE 4 — Catastro CRUD Completo
- [ ] Endpoints CRUD completos para cada tipo de elemento
- [ ] Página /catastro con TanStack Table
- [ ] Filtros avanzados por atributo
- [ ] Edición inline de registros
- [ ] Formularios modales para edición completa
- [ ] Herramientas de dibujo en mapa (MapLibre GL Draw) + guardar
- [ ] Importación masiva desde CSV
- [ ] Importación masiva desde Shapefile via UI
- [ ] Exportación a Excel/CSV

### FASE 5 — Motor Hidráulico
- [ ] `backend/app/services/hidraulica.py`: construcción de red WNTR
- [ ] Endpoint POST /api/simulacion/ejecutar (async con tareas background)
- [ ] Endpoint GET /api/simulacion/{id}/resultados
- [ ] Página /hidraulica con panel de parámetros
- [ ] Selector de área (toda la red o polígono dibujado)
- [ ] Indicador de progreso durante simulación
- [ ] Visualización de resultados en mapa (escala de colores)
- [ ] Tabla de resultados por nodo y tubería
- [ ] Historial y comparación de simulaciones
- [ ] Exportación de resultados (Excel/PDF)

### FASE 6 — Dashboard y Reportes
- [ ] Endpoints de estadísticas agregadas (/api/stats/*)
- [ ] Dashboard con KPIs (presión promedio, % buen estado, cobertura)
- [ ] Gráfica: distribución de materiales
- [ ] Gráfica: distribución de diámetros
- [ ] Gráfica: estado de conservación
- [ ] Gráfica: historial de simulaciones
- [ ] Generación de reporte de catastro (PDF con WeasyPrint)
- [ ] Generación de reporte de simulación (PDF + Excel)
- [ ] Página /reportes con vista previa y descarga

---

## 8. API Endpoints Principales

```
AUTH
POST   /api/auth/login
POST   /api/auth/refresh
POST   /api/auth/logout

TUBERÍAS
GET    /api/tuberias          ?bbox=&sector=&material=&estado=&page=&limit=
GET    /api/tuberias/{id}
POST   /api/tuberias
PUT    /api/tuberias/{id}
DELETE /api/tuberias/{id}
POST   /api/tuberias/importar
GET    /api/tuberias/exportar ?formato=excel|csv

NODOS / VÁLVULAS / TANQUES / FUENTES
(misma estructura que tuberías)

SIMULACIÓN
POST   /api/simulacion/ejecutar
GET    /api/simulacion         ?page=&limit=
GET    /api/simulacion/{id}
GET    /api/simulacion/{id}/resultados
DELETE /api/simulacion/{id}

ESTADÍSTICAS
GET    /api/stats/resumen
GET    /api/stats/materiales
GET    /api/stats/diametros
GET    /api/stats/estado-red
GET    /api/stats/historial-simulaciones

REPORTES
GET    /api/reportes/catastro          ?formato=pdf|excel
GET    /api/reportes/simulacion/{id}   ?formato=pdf|excel

USUARIOS (solo admin)
GET    /api/usuarios
POST   /api/usuarios
PUT    /api/usuarios/{id}
DELETE /api/usuarios/{id}
```

---

## 9. Variables de Entorno (.env.example)

```env
# Base de datos
DATABASE_URL=postgresql+asyncpg://user:password@db:5432/sig_acueducto
SYNC_DATABASE_URL=postgresql://user:password@db:5432/sig_acueducto

# Autenticación JWT
SECRET_KEY=CAMBIAR_POR_CLAVE_ALEATORIA_256_BITS
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60
REFRESH_TOKEN_EXPIRE_DAYS=30

# CORS
ALLOWED_ORIGINS=https://tu-dominio.easypanel.host

# Martin Tile Server
MARTIN_DATABASE_URL=postgresql://user:password@db:5432/sig_acueducto

# Frontend (Vite env vars)
VITE_API_URL=https://api.tu-dominio.easypanel.host
VITE_TILES_URL=https://tiles.tu-dominio.easypanel.host

# Admin inicial (seed)
INITIAL_ADMIN_EMAIL=admin@acueducto-labateca.gov.co
INITIAL_ADMIN_PASSWORD=CAMBIAR_EN_PRODUCCION
```

---

## 10. Configuración de EasyPanel

| Servicio | Tipo | Puerto | Dominio |
|---|---|---|---|
| `sig-frontend` | Dockerfile | 80 | sig.labateca.gov.co |
| `sig-api` | Dockerfile | 8000 | api-sig.labateca.gov.co |
| `sig-db` | PostgreSQL | 5432 | (solo interno, sin dominio público) |
| `sig-tiles` | Dockerfile (Martin) | 3000 | tiles-sig.labateca.gov.co |

---

## 11. Convenciones de Código

- **Idioma del código:** Inglés (variables, funciones, clases)
- **Comentarios:** Español
- **Estilo de respuesta API:** `{"data": ..., "message": "...", "status": "success|error"}`
- **Geometrías en API:** Siempre GeoJSON en EPSG:4326
- **Fechas:** ISO 8601 UTC en API; convertir a hora local (UTC-5) en el frontend
- **Paginación:** Parámetros `?page=1&limit=50` en todos los listados
- **Commits:** Prefijos `feat:`, `fix:`, `refactor:`, `docs:`, `chore:`
- **Ramas:** `main` (producción), `develop` (integración), `feature/*` (funcionalidades)

---

## 12. Recursos y Referencias

- [WNTR Documentation](https://wntr.readthedocs.io/) — Motor de simulación hidráulica EPANET en Python
- [MapLibre GL JS](https://maplibre.org/maplibre-gl-js/docs/) — Librería de mapas
- [MapLibre GL Draw](https://github.com/maplibre/maplibre-gl-draw) — Edición de geometrías en mapa
- [OpenFreeMap](https://openfreemap.org/) — Tiles OSM vectoriales gratuitos sin API key
- [Martin Tile Server](https://martin.maplibre.org/) — Servidor de teselas desde PostGIS
- [PostGIS Docs](https://postgis.net/documentation/) — Extensión espacial de PostgreSQL
- [GeoAlchemy2](https://geoalchemy-2.readthedocs.io/) — ORM con soporte espacial para PostGIS
- [EPSG:9377](https://epsg.io/9377) — SIRGAS 2000 / CTM-12 (CRS de los shapefiles fuente)
- [FastAPI](https://fastapi.tiangolo.com/) — Framework backend Python
- [EasyPanel Docs](https://easypanel.io/docs) — Plataforma de despliegue

---

*Plan generado con asistencia de IA (Antigravity / Google DeepMind). Para continuar el desarrollo, identificar la fase incompleta en la sección 7 y retomar desde allí.*
