import { useState } from 'react'

const CAPAS = [
  {
    id: 'tuberias',
    nombre: 'Tuberías',
    geometria: 'LineString',
    archivo: 'tuberias.shp',
    color: 'var(--layer-tuberias)',
    descripcion: 'Red de distribución. Cada registro representa un tramo de tubería entre dos nodos.',
    campos: [
      { nombre: 'CODIGO',   tipo: 'String(20)',  req: true,  desc: 'Identificador único del tramo',                  ejemplo: 'TUB-001' },
      { nombre: 'DIAMETRO', tipo: 'Float',       req: true,  desc: 'Diámetro interior en milímetros',               ejemplo: '75' },
      { nombre: 'MATERIAL', tipo: 'String(50)',  req: false, desc: 'PVC · AC · HF · PE · Asbesto-Cemento · Otros', ejemplo: 'PVC' },
      { nombre: 'RUGOS_HW', tipo: 'Float',       req: false, desc: 'Coeficiente Hazen-Williams (C). Default: 130',  ejemplo: '140' },
      { nombre: 'AÑO_INST', tipo: 'Integer',     req: false, desc: 'Año de instalación',                            ejemplo: '2005' },
      { nombre: 'ESTADO',   tipo: 'String(20)',  req: false, desc: 'Bueno · Regular · Malo · Critico · Desconocido',ejemplo: 'Bueno' },
      { nombre: 'PRES_MAX', tipo: 'Float',       req: false, desc: 'Presión máxima de diseño (m.c.a)',              ejemplo: '35' },
      { nombre: 'ZONA',     tipo: 'String(50)',  req: false, desc: 'Nombre de la zona de presión',                  ejemplo: 'Zona Alta' },
      { nombre: 'SECTOR',   tipo: 'String(50)',  req: false, desc: 'Sector o barrio',                               ejemplo: 'Centro' },
      { nombre: 'OBS',      tipo: 'String(255)', req: false, desc: 'Observaciones adicionales',                     ejemplo: 'Requiere reposición' },
    ],
  },
  {
    id: 'nodos',
    nombre: 'Nodos / Uniones',
    geometria: 'Point',
    archivo: 'nodos.shp',
    color: 'var(--layer-nodos)',
    descripcion: 'Puntos de unión, derivación y conexión de usuarios. Cada intersección de tuberías debe ser un nodo.',
    campos: [
      { nombre: 'CODIGO',   tipo: 'String(20)', req: true,  desc: 'Identificador único del nodo',                        ejemplo: 'NOD-001' },
      { nombre: 'TIPO',     tipo: 'String(30)', req: false, desc: 'Union · Tee · Codo · Conexion · Hidrante · Otro',      ejemplo: 'Tee' },
      { nombre: 'COTA',     tipo: 'Float',      req: true,  desc: 'Cota topográfica en m.s.n.m.',                         ejemplo: '1450.5' },
      { nombre: 'DEM_BASE', tipo: 'Float',      req: false, desc: 'Demanda base en L/s (caudal de consumo del nodo)',     ejemplo: '0.35' },
      { nombre: 'TIPO_USU', tipo: 'String(30)', req: false, desc: 'Residencial · Comercial · Industrial · Institucional', ejemplo: 'Residencial' },
      { nombre: 'PRES_MIN', tipo: 'Float',      req: false, desc: 'Presión mínima requerida (m.c.a). Default: 10',       ejemplo: '15' },
      { nombre: 'NUM_USU',  tipo: 'Integer',    req: false, desc: 'Número de usuarios conectados en este nodo',          ejemplo: '8' },
      { nombre: 'ESTADO',   tipo: 'String(20)', req: false, desc: 'Activo · Inactivo · Desconocido',                     ejemplo: 'Activo' },
    ],
  },
  {
    id: 'valvulas',
    nombre: 'Válvulas',
    geometria: 'Point',
    archivo: 'valvulas.shp',
    color: 'var(--layer-valvulas)',
    descripcion: 'Elementos de control hidráulico: válvulas de corte, reguladoras de presión, compuertas, etc.',
    campos: [
      { nombre: 'CODIGO',   tipo: 'String(20)', req: true,  desc: 'Identificador único de la válvula',                ejemplo: 'VAL-001' },
      { nombre: 'TIPO',     tipo: 'String(10)', req: true,  desc: 'PRV · TCV · GPV · FCV · PBV · CV',                ejemplo: 'PRV' },
      { nombre: 'ESTADO',   tipo: 'String(20)', req: false, desc: 'Abierta · Cerrada · Parcial · Desconocido',        ejemplo: 'Abierta' },
      { nombre: 'DIAMETRO', tipo: 'Float',      req: false, desc: 'Diámetro nominal en mm',                          ejemplo: '75' },
      { nombre: 'COTA',     tipo: 'Float',      req: false, desc: 'Cota de instalación en m.s.n.m.',                 ejemplo: '1440' },
      { nombre: 'PRES_SET', tipo: 'Float',      req: false, desc: 'Solo para PRV: presión de salida fijada (m.c.a)', ejemplo: '20' },
    ],
  },
  {
    id: 'tanques',
    nombre: 'Tanques',
    geometria: 'Point',
    archivo: 'tanques.shp',
    color: 'var(--layer-tanques)',
    descripcion: 'Depósitos de almacenamiento y regulación del sistema.',
    campos: [
      { nombre: 'CODIGO',    tipo: 'String(20)',  req: true,  desc: 'Identificador único del tanque',      ejemplo: 'TAN-001' },
      { nombre: 'NOMBRE',    tipo: 'String(100)', req: false, desc: 'Nombre descriptivo del tanque',       ejemplo: 'Tanque Principal' },
      { nombre: 'COTA_FOND', tipo: 'Float',       req: true,  desc: 'Cota del fondo en m.s.n.m.',          ejemplo: '1460' },
      { nombre: 'COTA_TECH', tipo: 'Float',       req: true,  desc: 'Cota del techo (rebose) en m.s.n.m.', ejemplo: '1463' },
      { nombre: 'NIV_INIC',  tipo: 'Float',       req: false, desc: 'Nivel inicial del agua (m sobre fondo)',ejemplo: '2.5' },
      { nombre: 'NIV_MIN',   tipo: 'Float',       req: false, desc: 'Nivel mínimo operacional (m)',         ejemplo: '0.3' },
      { nombre: 'NIV_MAX',   tipo: 'Float',       req: false, desc: 'Nivel máximo (m sobre fondo)',         ejemplo: '3.0' },
      { nombre: 'CAPAC_M3',  tipo: 'Float',       req: false, desc: 'Capacidad total en m³',               ejemplo: '150' },
      { nombre: 'DIAM_M',    tipo: 'Float',       req: false, desc: 'Diámetro interno en metros',          ejemplo: '8' },
      { nombre: 'MATERIAL',  tipo: 'String(50)',  req: false, desc: 'Concreto · Acero · Fibra de vidrio',  ejemplo: 'Concreto' },
      { nombre: 'ESTADO',    tipo: 'String(20)',  req: false, desc: 'Operativo · Fuera de servicio · En mantenimiento', ejemplo: 'Operativo' },
    ],
  },
  {
    id: 'fuentes',
    nombre: 'Fuentes / Reservorios',
    geometria: 'Point',
    archivo: 'fuentes.shp',
    color: 'var(--layer-fuentes)',
    descripcion: 'Puntos de entrada al sistema: bocatomas, pozos, interconexiones. En EPANET son los "reservoirs".',
    campos: [
      { nombre: 'CODIGO',    tipo: 'String(20)',  req: true,  desc: 'Identificador único de la fuente',            ejemplo: 'FUE-001' },
      { nombre: 'NOMBRE',    tipo: 'String(100)', req: false, desc: 'Nombre descriptivo',                         ejemplo: 'Bocatoma Río Labateca' },
      { nombre: 'TIPO',      tipo: 'String(30)',  req: false, desc: 'Bocatoma · Pozo · Interconexion · Manantial', ejemplo: 'Bocatoma' },
      { nombre: 'COTA_PIEZ', tipo: 'Float',       req: true,  desc: 'Carga hidráulica total (m.s.n.m.) — es la cabeza piezométrica del reservorio', ejemplo: '1480' },
      { nombre: 'CAUDAL',    tipo: 'Float',       req: false, desc: 'Caudal disponible o concesionado en L/s',   ejemplo: '8.5' },
      { nombre: 'ESTADO',    tipo: 'String(20)',  req: false, desc: 'Activa · Inactiva · En mantenimiento',       ejemplo: 'Activa' },
    ],
  },
]

export default function GuiaShapefilePage() {
  const [activeTab, setActiveTab] = useState('tuberias')
  const capa = CAPAS.find(c => c.id === activeTab)

  return (
    <div className="page animate-fade">
      <div className="page-header flex justify-between items-center">
        <div>
          <h1 className="page-title">📐 Guía de Shapefile</h1>
          <p className="page-subtitle">Especificación técnica de campos y formatos para la importación de datos</p>
        </div>
        <button className="btn btn-outline" onClick={() => window.print()}>🖨️ Imprimir / PDF</button>
      </div>

      {/* Alerta CRS */}
      <div className="alert alert-warning" style={{ marginBottom: '1.5rem' }}>
        <span style={{ fontSize: '1.2rem' }}>⚠️</span>
        <div>
          <strong>Sistema de Coordenadas Requerido:</strong> Los shapefiles deben estar en <strong>SIRGAS 2000 / CTM-12 (EPSG:9377)</strong>.
          El sistema los transformará automáticamente a WGS84 (EPSG:4326) al importar.
          Verifique el CRS en QGIS: <em>Propiedades de capa → Información → SRC</em>.
        </div>
      </div>

      {/* Instrucciones de importación */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="card-header"><div className="card-title">📦 Archivos requeridos por capa</div></div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 12 }}>
          {CAPAS.map(c => (
            <div key={c.id} style={{
              background: 'var(--bg-base)', border: `1px solid ${c.color}33`,
              borderRadius: 8, padding: '12px', textAlign: 'center',
            }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: c.color, margin: '0 auto 8px' }} />
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>{c.nombre}</div>
              <code style={{ fontSize: 11, color: 'var(--accent)' }}>{c.archivo}</code>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>+ .dbf .shx .prj</div>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs por capa */}
      <div className="tabs" style={{ marginBottom: '1rem' }}>
        {CAPAS.map(c => (
          <button key={c.id} className={`tab${activeTab === c.id ? ' active' : ''}`} onClick={() => setActiveTab(c.id)}>
            <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: c.color, marginRight: 6 }} />
            {c.nombre}
          </button>
        ))}
      </div>

      {/* Tabla de campos */}
      <div className="card animate-fade" key={activeTab}>
        <div className="card-header">
          <div>
            <div className="card-title">{capa.nombre}</div>
            <div className="card-subtitle">Geometría: <strong>{capa.geometria}</strong> · Archivo: <code style={{color:'var(--accent)'}}>{capa.archivo}</code></div>
          </div>
          <span className="badge badge-primary">{capa.campos.filter(c=>c.req).length} campos obligatorios</span>
        </div>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: '1rem' }}>{capa.descripcion}</p>

        <div className="table-wrapper">
          <table className="spec-table">
            <thead>
              <tr>
                <th>Campo (nombre exacto)</th>
                <th>Tipo</th>
                <th>Req.</th>
                <th>Descripción</th>
                <th>Ejemplo</th>
              </tr>
            </thead>
            <tbody>
              {capa.campos.map(campo => (
                <tr key={campo.nombre}>
                  <td><code style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13, fontWeight: 600 }}>{campo.nombre}</code></td>
                  <td><span className="spec-type">{campo.tipo}</span></td>
                  <td>{campo.req ? <span className="spec-required">✓ Sí</span> : <span className="spec-optional">Opcional</span>}</td>
                  <td style={{ color: 'var(--text-secondary)', fontSize: 12.5 }}>{campo.desc}</td>
                  <td><code style={{ fontSize: 12, color: 'var(--text-muted)' }}>{campo.ejemplo}</code></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Notas adicionales */}
      <div className="grid grid-2" style={{ marginTop: '1.5rem', gap: '1rem' }}>
        <div className="card">
          <div className="card-title" style={{ marginBottom: 10 }}>✅ Pasos para preparar el shapefile</div>
          {['1. Abrir el shapefile en QGIS y verificar que el CRS sea EPSG:9377 (CTM-12)',
            '2. Verificar que todos los nombres de campo coincidan exactamente (mayúsculas)',
            '3. Verificar que las geometrías sean válidas: sin autointercepciones, sin duplicados',
            '4. Rellenar al menos los campos marcados como Obligatorios',
            '5. Exportar como Shapefile (.shp) con codificación UTF-8',
            '6. Comprimir los archivos .shp .dbf .shx .prj en un .zip',
            '7. Ir a Catastro → Importar y subir el .zip'].map((s, i) => (
            <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 8, fontSize: 13 }}>
              <span style={{ color: 'var(--success)', flexShrink: 0 }}>✓</span>
              <span style={{ color: 'var(--text-secondary)' }}>{s}</span>
            </div>
          ))}
        </div>
        <div className="card">
          <div className="card-title" style={{ marginBottom: 10 }}>⚠️ Errores comunes</div>
          {[
            ['Nombres de campo incorrectos', 'El sistema no reconocerá el campo. Verificar mayúsculas y sin tildes.'],
            ['CRS incorrecto', 'La red aparecerá desplazada en el mapa. Siempre usar EPSG:9377.'],
            ['Valores de COTA ausentes', 'La simulación hidráulica fallará sin cotas en nodos y tanques.'],
            ['Geometrías no válidas', 'Usar Vectorial → Herramientas de geometría → Comprobar validez en QGIS.'],
            ['Tuberías sin nodos extremos', 'Cada extremo de tubería debe coincidir exactamente con un nodo.'],
          ].map(([titulo, desc]) => (
            <div key={titulo} style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--warning)', marginBottom: 2 }}>⚠ {titulo}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
