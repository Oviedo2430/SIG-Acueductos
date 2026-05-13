import { useState, useRef } from 'react'
import { importApi } from '../services/api'

const TIPOS_CAPA = [
  { id: 'tuberias', label: 'Tuberías',           color: 'var(--layer-tuberias)', geom: 'LineString' },
  { id: 'nodos',    label: 'Nodos / Uniones',    color: 'var(--layer-nodos)',    geom: 'Point' },
  { id: 'valvulas', label: 'Válvulas',           color: 'var(--layer-valvulas)', geom: 'Point' },
  { id: 'tanques',  label: 'Tanques',            color: 'var(--layer-tanques)',  geom: 'Point' },
  { id: 'fuentes',  label: 'Fuentes/Reservorios',color: 'var(--layer-fuentes)',  geom: 'Point' },
]

export default function CatastroPage() {
  const [activeTab, setActiveTab] = useState('importar')
  const [selectedTipo, setSelectedTipo] = useState('tuberias')
  const [file, setFile] = useState(null)
  const [dragOver, setDragOver] = useState(false)
  const [estado, setEstado] = useState(null) // { tipo: 'loading'|'success'|'error', msg }
  const inputRef = useRef()

  const handleFile = (f) => {
    if (!f) return
    if (!f.name.endsWith('.zip')) { setEstado({ tipo: 'error', msg: 'Solo se aceptan archivos .zip con el shapefile comprimido.' }); return }
    setFile(f); setEstado(null)
  }

  const handleDrop = (e) => {
    e.preventDefault(); setDragOver(false)
    handleFile(e.dataTransfer.files[0])
  }

  const handleImport = async () => {
    if (!file) return
    setEstado({ tipo: 'loading', msg: 'Procesando y validando el shapefile...' })
    try {
      const fd = new FormData()
      fd.append('file', file)
      const { data } = await importApi.uploadShapefile(selectedTipo, fd)
      setEstado({ tipo: 'success', msg: `✅ ${data.message} — ${data.registros_importados} registros importados.` })
      setFile(null)
    } catch (err) {
      const msg = err.response?.data?.detail || 'Error al procesar el shapefile'
      setEstado({ tipo: 'error', msg: `❌ ${msg}` })
    }
  }

  return (
    <div className="page animate-fade">
      <div className="page-header flex justify-between items-center">
        <div>
          <h1 className="page-title">📋 Catastro de Red</h1>
          <p className="page-subtitle">Gestión de elementos de la red de acueducto</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs" style={{ marginBottom: '1.5rem', maxWidth: 400 }}>
        <button className={`tab${activeTab === 'importar' ? ' active' : ''}`} onClick={() => setActiveTab('importar')}>📥 Importar datos</button>
        <button className={`tab${activeTab === 'tabla' ? ' active' : ''}`} onClick={() => setActiveTab('tabla')}>📋 Ver catastro</button>
      </div>

      {/* ── TAB IMPORTAR ─────────────────────────────── */}
      {activeTab === 'importar' && (
        <div style={{ maxWidth: 720 }}>
          <div className="alert alert-info" style={{ marginBottom: '1.5rem' }}>
            ℹ️ Importe un shapefile comprimido en <strong>.zip</strong> (incluir .shp .dbf .shx .prj).
            El sistema transformará automáticamente de <strong>EPSG:9377 → WGS84</strong>.
            Consulte la <a href="/guia-shapefile">Guía de Shapefile</a> para ver los campos requeridos.
          </div>

          {/* Selector de tipo de capa */}
          <div className="card" style={{ marginBottom: '1rem' }}>
            <div className="card-title" style={{ marginBottom: 12 }}>1. Seleccionar tipo de capa</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 8 }}>
              {TIPOS_CAPA.map(t => (
                <button
                  key={t.id}
                  onClick={() => setSelectedTipo(t.id)}
                  style={{
                    background: selectedTipo === t.id ? `${t.color}22` : 'var(--bg-base)',
                    border: `1px solid ${selectedTipo === t.id ? t.color : 'var(--border)'}`,
                    borderRadius: 8, padding: '10px 8px', cursor: 'pointer', textAlign: 'center',
                    transition: 'all .15s ease',
                  }}
                >
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: t.color, margin: '0 auto 6px' }} />
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)' }}>{t.label}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{t.geom}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Zona de carga */}
          <div className="card">
            <div className="card-title" style={{ marginBottom: 12 }}>2. Cargar archivo .zip</div>
            <div
              className={`upload-zone${dragOver ? ' drag-over' : ''}`}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => inputRef.current.click()}
            >
              <input ref={inputRef} type="file" accept=".zip" style={{ display: 'none' }} onChange={e => handleFile(e.target.files[0])} />
              <div className="upload-zone-icon">📦</div>
              {file
                ? <><div style={{ fontWeight: 600, color: 'var(--primary)' }}>{file.name}</div><div className="upload-zone-hint">{(file.size/1024).toFixed(0)} KB — Listo para importar</div></>
                : <><div className="upload-zone-text">Arrastre el archivo .zip aquí o haga clic</div><div className="upload-zone-hint">Solo archivos .zip · Máx. 50MB</div></>
              }
            </div>

            {estado && (
              <div className={`alert ${estado.tipo === 'success' ? 'alert-success' : estado.tipo === 'error' ? 'alert-danger' : 'alert-info'}`} style={{ marginTop: 12 }}>
                {estado.tipo === 'loading' && <span className="animate-spin">⟳</span>}
                {estado.msg}
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button className="btn btn-primary" onClick={handleImport} disabled={!file || estado?.tipo === 'loading'}>
                {estado?.tipo === 'loading' ? '⟳ Importando...' : '📥 Importar shapefile'}
              </button>
              {file && <button className="btn btn-ghost" onClick={() => { setFile(null); setEstado(null) }}>✕ Cancelar</button>}
              <a href="/guia-shapefile" className="btn btn-outline" style={{ marginLeft: 'auto' }}>📐 Ver guía de campos</a>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB CATASTRO ─────────────────────────────── */}
      {activeTab === 'tabla' && (
        <div>
          <div className="alert alert-info" style={{ marginBottom: '1.5rem' }}>
            ℹ️ La tabla de catastro estará disponible una vez que importe los datos del shapefile.
            Los datos se cargan desde la API del backend.
          </div>
          <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📂</div>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Sin datos importados</div>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
              Importe los shapefiles del catastro para ver y editar los elementos de la red.
            </p>
            <button className="btn btn-primary" onClick={() => setActiveTab('importar')}>📥 Ir a importar</button>
          </div>
        </div>
      )}
    </div>
  )
}
