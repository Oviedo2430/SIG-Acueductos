# PLAN TÉCNICO MAESTRO
# SIG-Acueducto — Sistema de Información Geográfica para el Acueducto Urbano de Labateca
# Norte de Santander, Colombia

**Repositorio:** https://github.com/Oviedo2430/SIG-Acueductos  
**Ruta local:** `C:\Users\Carlos SIG\Desktop\SIG Acueducto JPM`  
**Última actualización:** 2026-05-13  
**Estado general:** ✅ Fases 1–6 completadas · Fase 7 (despliegue) pendiente

---

## 1. OBJETIVO DEL PROYECTO

Desarrollar un sistema web completo para la gestión catastral y el modelado hidráulico del sistema de acueducto urbano del municipio de Labateca (Norte de Santander). El sistema integra un visor GIS interactivo, un módulo de catastro de red, simulación hidráulica con WNTR (equivalente a EPANET) y un dashboard de indicadores.

---

## 2. STACK TECNOLÓGICO

| Capa | Tecnología | Versión |
|---|---|---|
| **Frontend** | React + Vite | React 18, Vite 5 |
| **Mapa** | MapLibre GL JS | — |
| **Gráficas** | Apache ECharts (echarts-for-react) | — |
| **Estado global** | Zustand | — |
| **Tablas** | TanStack Table | — |
| **Formularios** | React Hook Form + Zod | — |
| **HTTP** | Axios + TanStack Query | — |
| **Backend** | FastAPI (Python) | 0.111 |
| **Modelado hidráulico** | WNTR | 1.2.0 |
| **Base de datos** | PostgreSQL + PostGIS | PG 15, PostGIS 3.4 |
| **Tile server** | Martin (vectores MVT) | — |
| **ORM** | SQLAlchemy 2.0 async + GeoAlchemy2 | — |
| **Despliegue** | EasyPanel (Docker) | — |

### Sistema de coordenadas
- **Origen de datos:** SIRGAS 2000 / CTM-12 (EPSG:9377)
- **Almacenamiento y visualización:** WGS84 (EPSG:4326)
- **Transformación:** automática en la importación con `pyproj`

---

## 3. ARQUITECTURA DEL SISTEMA

```
┌─────────────────────────────── EasyPanel ──────────────────────────────────┐
│                                                                             │
│  [sig-frontend]  ──HTTPS──▶  [sig-api]  ──red interna──▶  [sig-db]       │
│    React + Nginx              FastAPI                      PostGIS          │
│      Puerto 80                Puerto 8000                  Puerto 5432      │
│                                    │                                        │
│                                    └──────────────────▶  [sig-tiles]       │
│                                                           Martin MVT        │
│                                                           Puerto 3000       │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Comunicación entre servicios
- Frontend → API: proxy `/api` → `http://sig-api:8000`
- Frontend → Tiles: proxy `/tiles` → `http://sig-tiles:3000`
- API → BD: `postgresql+asyncpg://siguser:clave@sig-db:5432/sig_acueducto`
- Tiles → BD: misma conexión directa a PostGIS

---

## 4. ESTRUCTURA DEL REPOSITORIO

```
SIG Acueducto JPM/
│
├── PLAN_TECNICO.md               ← Este documento
├── .env.example                  ← Variables de entorno (plantilla)
├── .gitignore
├── docker-compose.yml            ← Desarrollo local completo
│
├── database/
│   ├── init.sql                  ← Esquemas + tablas PostGIS (auto-ejecutado)
│   └── martin.yaml               ← Config del tile server
│
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   └── app/
│       ├── main.py               ← FastAPI entry point + routers
│       ├── config.py             ← Settings via pydantic-settings
│       ├── database.py           ← SQLAlchemy async + get_db
│       ├── auth/
│       │   ├── utils.py          ← JWT: create_token, verify_password
│       │   ├── dependencies.py   ← get_current_user, require_role()
│       │   └── router.py         ← POST /auth/login, GET /auth/me, POST /auth/refresh
│       ├── models/
│       │   ├── usuarios.py       ← auth.usuarios (SQLAlchemy)
│       │   ├── red.py            ← gis.tuberias/nodos/valvulas/tanques/fuentes
│       │   └── simulacion.py     ← hidraulica.simulaciones
│       ├── schemas/
│       │   ├── usuarios.py       ← Pydantic: UsuarioCreate/Update/Response, TokenResponse
│       │   ├── red.py            ← Pydantic: schemas de todas las capas GIS
│       │   └── simulacion.py     ← Pydantic: SimulacionConfig/Response/Detalle
│       ├── routers/
│       │   ├── usuarios.py       ← CRUD usuarios (solo admin)
│       │   ├── red.py            ← CRUD tuberías/nodos/válvulas/tanques/fuentes + GeoJSON
│       │   ├── importacion.py    ← POST /importacion/shapefile/{tipo}
│       │   ├── simulacion.py     ← POST/GET /simulacion
│       │   └── reportes.py       ← GET /reportes/dashboard-stats, exportar CSV/Excel
│       ├── services/
│       │   └── wntr_service.py   ← Motor WNTR: construir red, ejecutar, extraer resultados
│       └── lib/
│           └── geo.py            ← geom_to_geojson(), geojson_to_geom()
│
└── frontend/
    ├── Dockerfile.dev
    ├── vite.config.js            ← Proxy /api y /tiles
    ├── package.json
    └── src/
        ├── main.jsx              ← QueryClient + BrowserRouter + StrictMode
        ├── App.jsx               ← Rutas con ProtectedRoute y AdminRoute
        ├── index.css             ← Sistema de diseño completo (tema oscuro GIS)
        ├── store/
        │   ├── authStore.js      ← Zustand: token, user, login, logout (persistido)
        │   └── mapStore.js       ← Zustand: capas visibles, feature seleccionado, sim results
        ├── services/
        │   └── api.js            ← Axios con interceptores JWT + endpoints por módulo
        ├── components/
        │   ├── Layout/
        │   │   ├── Layout.jsx    ← Shell: topbar + sidebar + Outlet
        │   │   └── Sidebar.jsx   ← Navegación + panel de capas (filtrado por rol)
        │   └── Map/
        │       └── MapViewer.jsx ← MapLibre + OpenFreeMap + capas demo Labateca
        └── pages/
            ├── LoginPage.jsx     ← Login real + modo demo (sin backend)
            ├── MapPage.jsx       ← Visor GIS con leyenda, panel de feature, control de coloración
            ├── CatastroPage.jsx  ← TanStack Table + importación shapefile + edición
            ├── SimulacionPage.jsx← Configuración WNTR + historial + resultados
            ├── DashboardPage.jsx ← ECharts: gauge, donut, barras, líneas + exportaciones
            ├── GuiaShapefilePage.jsx ← Especificación técnica de campos por capa
            ├── AdminPage.jsx     ← CRUD usuarios + tabla de permisos por rol
            └── DashboardPage.jsx ← BI con ECharts
```

---

## 5. ESQUEMA DE BASE DE DATOS

### Esquema `auth`
```sql
auth.usuarios (
  id, email, hashed_password, nombre_completo,
  rol,           -- 'admin' | 'operador' | 'tecnico' | 'visualizador'
  activo, ultimo_acceso, creado_en, actualizado_en
)
```

### Esquema `gis`
```sql
gis.tuberias (
  id, codigo, geom (LINESTRING 4326),
  diametro_mm, material, rugosidad_hw, year_instalacion,
  estado, presion_max_mca, zona_presion, sector, observaciones,
  fecha_registro, fecha_actualizacion, usuario_id
)

gis.nodos (
  id, codigo, geom (POINT 4326),
  tipo, cota_msnm, demanda_base_lps, tipo_usuario,
  presion_min_req_mca, num_usuarios, estado, observaciones,
  fecha_registro, fecha_actualizacion, usuario_id
)

gis.valvulas (
  id, codigo, geom (POINT 4326),
  tipo,  -- PRV | TCV | GPV | FCV | PBV | CV
  estado, diametro_mm, cota_msnm, presion_setting, tuberia_id,
  fecha_registro, fecha_actualizacion, usuario_id
)

gis.tanques (
  id, codigo, geom (POINT 4326),
  nombre, cota_fondo_msnm, cota_techo_msnm,
  nivel_inicial_m, nivel_min_m, nivel_max_m,
  capacidad_m3, diametro_m, material, estado,
  fecha_registro, fecha_actualizacion, usuario_id
)

gis.fuentes (
  id, codigo, geom (POINT 4326),
  nombre, tipo, cota_piezometrica_msnm,
  caudal_disponible_lps, calidad_agua, estado,
  fecha_registro, fecha_actualizacion, usuario_id
)
```

### Esquema `hidraulica`
```sql
hidraulica.simulaciones (
  id, nombre, descripcion, estado,
  duracion_horas, paso_tiempo_min, factor_demanda, modo_simulacion,
  resultados_nodos    (JSON),   -- {codigo: {presion_mca, cota_piezometrica}}
  resultados_tuberias (JSON),   -- {codigo: {velocidad_ms, caudal_lps}}
  presion_min_mca, presion_max_mca, presion_media_mca,
  nodos_criticos, nodos_total, tuberias_total,
  mensaje_error, fecha_creacion, fecha_inicio_ejecucion,
  fecha_fin_ejecucion, duracion_calculo_seg, usuario_id
)
```

---

## 6. API ENDPOINTS

### Autenticación
| Método | Endpoint | Descripción |
|---|---|---|
| POST | `/api/v1/auth/login` | Login → retorna JWT |
| GET  | `/api/v1/auth/me` | Usuario actual |
| POST | `/api/v1/auth/refresh` | Renovar token |

### Usuarios (solo admin)
| Método | Endpoint | Descripción |
|---|---|---|
| GET  | `/api/v1/usuarios` | Listar todos |
| POST | `/api/v1/usuarios` | Crear usuario |
| PUT  | `/api/v1/usuarios/{id}` | Actualizar |
| DELETE | `/api/v1/usuarios/{id}` | Desactivar |

### Red GIS (por cada capa: tuberias/nodos/valvulas/tanques/fuentes)
| Método | Endpoint | Descripción |
|---|---|---|
| GET  | `/api/v1/{capa}` | Listar (paginado) |
| GET  | `/api/v1/{capa}/geojson` | GeoJSON FeatureCollection (para MapLibre) |
| GET  | `/api/v1/{capa}/{id}` | Obtener uno |
| POST | `/api/v1/{capa}` | Crear |
| PUT  | `/api/v1/{capa}/{id}` | Actualizar |
| DELETE | `/api/v1/{capa}/{id}` | Eliminar |
| GET  | `/api/v1/red/stats` | Conteos por capa |

### Importación
| Método | Endpoint | Descripción |
|---|---|---|
| POST | `/api/v1/importacion/shapefile/{tipo}` | Importar ZIP con shapefile |
| POST | `/api/v1/importacion/validar/{tipo}` | Validar sin importar |

### Simulación hidráulica
| Método | Endpoint | Descripción |
|---|---|---|
| POST | `/api/v1/simulacion` | Crear y ejecutar simulación WNTR |
| GET  | `/api/v1/simulacion` | Listar historial |
| GET  | `/api/v1/simulacion/{id}` | Obtener con resultados |
| DELETE | `/api/v1/simulacion/{id}` | Eliminar |

### Reportes y exportación
| Método | Endpoint | Descripción |
|---|---|---|
| GET | `/api/v1/reportes/dashboard-stats` | KPIs + distribuciones para el dashboard |
| GET | `/api/v1/reportes/exportar/{tipo}?formato=csv\|excel` | Exportar capa |
| GET | `/api/v1/reportes/exportar/simulacion/{id}?formato=csv\|excel` | Exportar simulación |

---

## 7. ROLES Y PERMISOS

| Módulo | Admin | Operador | Técnico | Visualizador |
|---|---|---|---|---|
| Visor GIS | Editar | Editar | Ver | Ver |
| Catastro (CRUD) | Completo | Completo | Solo estado | Ver |
| Simulación hidráulica | Ejecutar | Ejecutar | — | Ver resultados |
| Dashboard | ✅ | ✅ | ✅ | ✅ |
| Exportar reportes | ✅ | ✅ | Ver | Descargar |
| Admin usuarios | ✅ | — | — | — |

---

## 8. IMPORTACIÓN DE SHAPEFILES

### Flujo completo
```
1. Usuario comprime shapefile en .zip (incluir .shp .dbf .shx .prj)
2. Ir a Catastro → Importar
3. Seleccionar tipo de capa
4. Subir el .zip
5. FastAPI extrae, lee con Fiona, transforma EPSG:9377 → 4326 con pyproj
6. Valida campos obligatorios
7. Inserta en PostGIS en batch
8. Retorna conteo de importados y errores
```

### Campos por shapefile

#### tuberias.shp (LineString)
| Campo | Tipo | Req | Descripción |
|---|---|---|---|
| CODIGO | String(20) | ✅ | Identificador único |
| DIAMETRO | Float | ✅ | Diámetro interior (mm) |
| MATERIAL | String(50) | — | PVC, AC, HF, PE, Asbesto-Cemento |
| RUGOS_HW | Float | — | Coeficiente Hazen-Williams (default: 130) |
| AÑO_INST | Integer | — | Año de instalación |
| ESTADO | String(20) | — | Bueno, Regular, Malo, Critico |
| PRES_MAX | Float | — | Presión máxima de diseño (m.c.a) |
| ZONA | String(50) | — | Zona de presión |
| SECTOR | String(50) | — | Sector o barrio |
| OBS | String(255) | — | Observaciones |

#### nodos.shp (Point)
| Campo | Tipo | Req | Descripción |
|---|---|---|---|
| CODIGO | String(20) | ✅ | Identificador único |
| COTA | Float | ✅ | Cota topográfica (m.s.n.m.) |
| TIPO | String(30) | — | Union, Tee, Codo, Conexion, Hidrante |
| DEM_BASE | Float | — | Demanda base (L/s) |
| TIPO_USU | String(30) | — | Residencial, Comercial, etc. |
| PRES_MIN | Float | — | Presión mínima requerida (m.c.a) |
| NUM_USU | Integer | — | Número de usuarios conectados |
| ESTADO | String(20) | — | Activo, Inactivo |

#### valvulas.shp (Point)
| Campo | Tipo | Req | Descripción |
|---|---|---|---|
| CODIGO | String(20) | ✅ | Identificador único |
| TIPO | String(10) | ✅ | PRV, TCV, GPV, FCV, PBV, CV |
| ESTADO | String(20) | — | Abierta, Cerrada, Parcial |
| DIAMETRO | Float | — | Diámetro nominal (mm) |
| COTA | Float | — | Cota de instalación (m.s.n.m.) |
| PRES_SET | Float | — | Solo PRV: presión de salida (m.c.a) |

#### tanques.shp (Point)
| Campo | Tipo | Req | Descripción |
|---|---|---|---|
| CODIGO | String(20) | ✅ | Identificador único |
| COTA_FOND | Float | ✅ | Cota del fondo (m.s.n.m.) |
| COTA_TECH | Float | ✅ | Cota del techo/rebose (m.s.n.m.) |
| NOMBRE | String(100) | — | Nombre descriptivo |
| NIV_INIC | Float | — | Nivel inicial (m sobre fondo) |
| NIV_MIN | Float | — | Nivel mínimo (m) |
| NIV_MAX | Float | — | Nivel máximo (m) |
| CAPAC_M3 | Float | — | Capacidad total (m³) |
| DIAM_M | Float | — | Diámetro interno (m) |
| MATERIAL | String(50) | — | Concreto, Acero, Fibra de vidrio |
| ESTADO | String(20) | — | Operativo, Fuera de servicio |

#### fuentes.shp (Point)
| Campo | Tipo | Req | Descripción |
|---|---|---|---|
| CODIGO | String(20) | ✅ | Identificador único |
| COTA_PIEZ | Float | ✅ | Carga hidráulica total (m.s.n.m.) |
| NOMBRE | String(100) | — | Nombre descriptivo |
| TIPO | String(30) | — | Bocatoma, Pozo, Manantial, Interconexion |
| CAUDAL | Float | — | Caudal disponible (L/s) |
| ESTADO | String(20) | — | Activa, Inactiva |

---

## 9. MODELADO HIDRÁULICO (WNTR)

### Equivalencias con EPANET
| EPANET | WNTR / Este sistema |
|---|---|
| Junction | Nodo (gis.nodos) |
| Reservoir | Fuente (gis.fuentes) |
| Tank | Tanque (gis.tanques) |
| Pipe | Tubería (gis.tuberias) |
| Valve (PRV/TCV/etc.) | Válvula (gis.valvulas) |

### Parámetros de simulación
- **Duración:** 0.5 a 168 horas
- **Paso de tiempo:** 5 a 360 minutos
- **Factor de demanda:** 0.1× a 3.0× (multiplicador global de demandas)
- **Modos:** Estacionaria (instantánea) o Período extendido

### Lógica de construcción de la red
1. Carga todos los elementos de PostGIS
2. Si la BD está vacía → usa red de demostración de Labateca (6 nodos, 7 tuberías, 1 tanque, 1 fuente)
3. Asigna topología de tuberías detectando el nodo más cercano a cada extremo (tolerancia: 0.001°)
4. Ejecuta `WNTRSimulator` (sin dependencia de EPANET)
5. Extrae presión (m.c.a.) por nodo y velocidad (m/s) + caudal (L/s) por tubería

### Criterios de alerta
| Indicador | Valor crítico |
|---|---|
| Presión mínima | < 5 m.c.a |
| Presión baja | 5–10 m.c.a |
| Velocidad baja (riesgo sedimentación) | < 0.3 m/s |
| Velocidad alta (riesgo erosión) | > 2.5 m/s |

---

## 10. DESPLIEGUE EN EASYPANEL (Fase 7 — Pendiente)

### Servicios a crear en EasyPanel
| Servicio | Imagen | Descripción |
|---|---|---|
| `sig-db` | `postgis/postgis:15-3.4` | PostgreSQL con PostGIS |
| `sig-api` | GitHub → `./backend/Dockerfile` | FastAPI + WNTR |
| `sig-tiles` | `ghcr.io/maplibre/martin:latest` | Tile server MVT |
| `sig-frontend` | GitHub → `./frontend/Dockerfile` | React + Nginx |

### Variables de entorno en EasyPanel
```bash
# sig-db
POSTGRES_USER=siguser
POSTGRES_PASSWORD=clave_segura_aqui
POSTGRES_DB=sig_acueducto

# sig-api
DATABASE_URL=postgresql+asyncpg://siguser:clave@sig-db:5432/sig_acueducto
SECRET_KEY=clave_jwt_muy_larga_y_aleatoria
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60
ADMIN_EMAIL=admin@acueducto.gov.co
ADMIN_PASSWORD=clave_admin_inicial
ALLOWED_ORIGINS=https://tu-dominio.easypanel.host

# sig-tiles
DATABASE_URL=postgresql://siguser:clave@sig-db:5432/sig_acueducto

# sig-frontend
VITE_API_URL=https://sig-api.tu-dominio.easypanel.host
VITE_TILES_URL=https://sig-tiles.tu-dominio.easypanel.host
```

### GitHub → EasyPanel (auto-deploy)
```
git push → GitHub (rama main)
               ↓
       EasyPanel detecta el push
               ↓
       Reconstruye la imagen Docker
               ↓
       Reemplaza el contenedor (zero-downtime)
```

---

## 11. ROADMAP DE FASES

| Fase | Descripción | Estado |
|---|---|---|
| **1** | Infraestructura base (Docker, BD PostGIS, FastAPI, Martin) | ✅ Completada |
| **2** | Visor GIS MapLibre + sistema de diseño + guía de shapefile | ✅ Completada |
| **3** | Autenticación JWT + gestión de usuarios + roles | ✅ Completada |
| **4** | CRUD catastro + importación shapefiles EPSG:9377 | ✅ Completada |
| **5** | Modelado hidráulico WNTR (simulación, presiones, velocidades) | ✅ Completada |
| **6** | Dashboard ECharts + KPIs + exportación CSV/Excel | ✅ Completada |
| **7** | Despliegue en EasyPanel (Docker prod, nginx, CI/CD) | 🔄 Pendiente |
| **8** | Edición de geometrías en el mapa (MapLibre Draw) | 🔄 Pendiente |
| **9** | Exportación EPANET .INP + análisis avanzados WNTR | 🔄 Pendiente |
| **10** | Reportes PDF automáticos + notificaciones | 🔄 Pendiente |

---

## 12. CÓMO RETOMAR EL DESARROLLO

### Para cualquier miembro del equipo

```bash
# 1. Clonar el repositorio
git clone https://github.com/Oviedo2430/SIG-Acueductos.git
cd SIG-Acueductos

# 2. Copiar variables de entorno
cp .env.example .env
# Editar .env con las credenciales correspondientes

# 3. Levantar toda la infraestructura local
docker-compose up -d

# 4. Instalar dependencias del frontend (primera vez)
cd frontend
npm install

# 5. Iniciar el servidor de desarrollo del frontend
npm run dev
# → Abre http://localhost:5173 en el navegador
# → Click en "Ingresar en modo demo" para explorar sin backend

# 6. Acceder a la API
# → Swagger UI: http://localhost:8000/api/v1/docs
# → Health check: http://localhost:8000/api/v1/health
```

### Comandos útiles de desarrollo
```bash
# Ver logs de todos los servicios Docker
docker-compose logs -f

# Reconstruir solo el backend
docker-compose up -d --build api

# Ejecutar migraciones manualmente
docker-compose exec api alembic upgrade head

# Conectar a la base de datos
docker-compose exec db psql -U siguser -d sig_acueducto
```

---

*Documento generado y mantenido con Antigravity AI · Proyecto SIG-Acueducto Labateca*
