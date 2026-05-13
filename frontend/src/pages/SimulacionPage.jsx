import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../services/api'
import { useMapStore } from '../store/mapStore'

const PRESION_COLORS = [
  { min: 0,   max: 5,   color: '#ef4444', label: '< 5 m.c.a (Crítica)' },
  { min: 5,   max: 10,  color: '#f97316', label: '5–10 m.c.a (Baja)' },
  { min: 10,  max: 20,  color: '#eab308', label: '10–20 m.c.a (Aceptable)' },
  { min: 20,  max: 35,  color: '#22c55e', label: '20–35 m.c.a (Óptima)' },
  { min: 35,  max: 999, color: '#3b82f6', label: '> 35 m.c.a (Alta)' },
]

function presionColor(p) {
  const band = PRESION_COLORS.find(b => p >= b.min && p < b.max)
  return band?.color || '#94a3b8'
}

const DEFAULT_CONFIG = {
  nombre: '',
  descripcion: '',
  duracion_horas: 24,
  paso_tiempo_min: 60,
  factor_demanda: 1.0,
  modo_simulacion: 'estacionaria',
}

export default function SimulacionPage() {
  const qc = useQueryClient()
  const { setSimulationResults } = useMapStore()
  const [config, setConfig] = useState(DEFAULT_CONFIG)
  const [activeSimId, setActiveSimId] = useState(null)
  const [activeTab, setActiveTab] = useState('nodos')

  // ── Historial de simulaciones ─────────────────────────────
  const { data: historial = [], isLoading: loadingList } = useQuery({
    queryKey: ['simulaciones'],
    queryFn: () => api.get('/simulacion').then(r => r.data),
    retry: false,
  })

  // ── Simulación activa (con resultados) ────────────────────
  const { data: simActiva } = useQuery({
    queryKey: ['simulacion', activeSimId],
    queryFn: () => api.get(`/simulacion/${activeSimId}`).then(r => r.data),
    enabled: !!activeSimId,
    onSuccess: (data) => {
      if (data.resultados_nodos) setSimulationResults(data.resultados_nodos)
    },
    retry: false,
  })

  // ── Ejecutar nueva simulación ─────────────────────────────
  const runMutation = useMutation({
    mutationFn: (data) => api.post('/simulacion', data),
    onSuccess: (res) => {
      qc.invalidateQueries(['simulaciones'])
      setActiveSimId(res.data.id)
    },
  })

  const handleRun = (e) => {
    e.preventDefault()
    if (!config.nombre.trim()) return alert('Ingresa un nombre para la simulación')
    runMutation.mutate(config)
  }

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/simulacion/${id}`),
    onSuccess: () => {
      qc.invalidateQueries(['simulaciones'])
      if (activeSimId) setActiveSimId(null)
    },
  })

  const nodosOrdenados = simActiva?.resultados_nodos
    ? Object.entries(simActiva.resultados_nodos).sort((a, b) => a[1].presion_mca - b[1].presion_mca)
    : []

  const tuberiasOrdenadas = simActiva?.resultados_tuberias
    ? Object.entries(simActiva.resultados_tuberias).sort((a, b) => b[1].velocidad_ms - a[1].velocidad_ms)
    : []

  return (
    <div className="page animate-fade">
      <div className="page-header">
        <h1 className="page-title">💧 Modelado Hidráulico</h1>
        <p className="page-subtitle">Simulación de la red usando WNTR (Water Network Tool for Resilience)</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '1.25rem', alignItems: 'start' }}>

        {/* ── Panel izquierdo: config + historial ─────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

          {/* Formulario de configuración */}
          <div className="card">
            <div className="card-title" style={{ marginBottom: 14 }}>⚙️ Nueva simulación</div>
            <form onSubmit={handleRun} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div className="form-group">
                <label className="form-label required">Nombre</label>
                <input id="sim-nombre" className="form-control" placeholder="Ej. Escenario demanda máxima" value={config.nombre}
                  onChange={e => setConfig({ ...config, nombre: e.target.value })} required />
              </div>
              <div className="form-group">
                <label className="form-label">Descripción</label>
                <textarea className="form-control" rows={2} placeholder="Condiciones de la simulación..." value={config.descripcion}
                  onChange={e => setConfig({ ...config, descripcion: e.target.value })} style={{ resize: 'vertical' }} />
              </div>
              <div className="grid grid-2" style={{ gap: '0.75rem' }}>
                <div className="form-group">
                  <label className="form-label">Duración (h)</label>
                  <input type="number" className="form-control" min={1} max={168} value={config.duracion_horas}
                    onChange={e => setConfig({ ...config, duracion_horas: Number(e.target.value) })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Paso (min)</label>
                  <input type="number" className="form-control" min={5} max={360} step={5} value={config.paso_tiempo_min}
                    onChange={e => setConfig({ ...config, paso_tiempo_min: Number(e.target.value) })} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Factor de demanda <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>(1.0 = normal)</span></label>
                <input type="range" min={0.1} max={3} step={0.1} value={config.factor_demanda}
                  onChange={e => setConfig({ ...config, factor_demanda: Number(e.target.value) })}
                  style={{ width: '100%', accentColor: 'var(--primary)' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)' }}>
                  <span>0.1×</span><span style={{ color: 'var(--primary)', fontWeight: 600 }}>{config.factor_demanda}×</span><span>3.0×</span>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Tipo de simulación</label>
                <select className="form-control" value={config.modo_simulacion}
                  onChange={e => setConfig({ ...config, modo_simulacion: e.target.value })}>
                  <option value="estacionaria">Estacionaria (instantánea)</option>
                  <option value="periodo_extendido">Período extendido ({config.duracion_horas}h)</option>
                </select>
              </div>

              <button id="btn-ejecutar-sim" type="submit" className="btn btn-primary w-full" disabled={runMutation.isPending}>
                {runMutation.isPending ? <><span className="animate-spin">⟳</span> Ejecutando WNTR...</> : '▶ Ejecutar simulación'}
              </button>
            </form>

            {runMutation.isError && (
              <div className="alert alert-danger" style={{ marginTop: 10 }}>
                {runMutation.error?.response?.data?.detail || 'Error al ejecutar. ¿Está el backend activo?'}
              </div>
            )}
          </div>

          {/* Historial */}
          <div className="card">
            <div className="card-title" style={{ marginBottom: 10 }}>🕐 Historial</div>
            {loadingList ? (
              <div className="text-muted text-sm">Cargando...</div>
            ) : historial.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-muted)', fontSize: 13 }}>
                Sin simulaciones ejecutadas
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {historial.map(s => (
                  <div key={s.id} onClick={() => setActiveSimId(s.id)} style={{
                    padding: '8px 10px', borderRadius: 6, cursor: 'pointer',
                    background: activeSimId === s.id ? 'rgba(14,165,233,.15)' : 'var(--bg-base)',
                    border: `1px solid ${activeSimId === s.id ? 'var(--primary)' : 'var(--border)'}`,
                    transition: 'all .15s',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 13, fontWeight: 600 }}>{s.nombre}</span>
                      <span className={`badge ${s.estado === 'completada' ? 'badge-success' : s.estado === 'error' ? 'badge-danger' : 'badge-warning'}`} style={{ fontSize: 10 }}>
                        {s.estado}
                      </span>
                    </div>
                    {s.presion_media_mca != null && (
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>
                        P̄={s.presion_media_mca} m · Críticos: {s.nodos_criticos}/{s.nodos_total}
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                      <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                        {s.fecha_creacion ? new Date(s.fecha_creacion).toLocaleDateString('es-CO') : ''} · {s.duracion_calculo_seg?.toFixed(1)}s
                      </span>
                      <button className="btn btn-danger btn-sm" style={{ fontSize: 10, padding: '1px 6px' }}
                        onClick={e => { e.stopPropagation(); if (window.confirm('¿Eliminar?')) deleteMutation.mutate(s.id) }}>🗑</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Panel derecho: resultados ────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {!simActiva ? (
            <div className="card" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>💧</div>
              <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Sin resultados activos</div>
              <p style={{ color: 'var(--text-secondary)', maxWidth: 400, margin: '0 auto 1.5rem' }}>
                Ejecute una nueva simulación o seleccione una del historial para ver los resultados.
                Si no tiene datos importados, se usará la <strong>red de demostración</strong> de Labateca.
              </p>
              <div className="alert alert-info" style={{ maxWidth: 420, margin: '0 auto', textAlign: 'left' }}>
                ℹ️ WNTR simula condiciones hidráulicas: presión en nodos, velocidad y caudal en tuberías, detecta zonas críticas.
              </div>
            </div>
          ) : (
            <>
              {/* Stats rápidas */}
              {simActiva.descripcion?.includes('demostración') && (
                <div className="alert alert-warning">
                  ⚠️ Resultados sobre red de demostración — sin shapefile importado
                </div>
              )}
              {simActiva.mensaje_error && (
                <div className="alert alert-danger">❌ {simActiva.mensaje_error}</div>
              )}

              <div className="grid grid-4">
                {[
                  { label: 'Presión mínima', value: `${simActiva.presion_min_mca ?? '—'} m.c.a`, color: presionColor(simActiva.presion_min_mca || 0) },
                  { label: 'Presión media', value: `${simActiva.presion_media_mca ?? '—'} m.c.a`, color: presionColor(simActiva.presion_media_mca || 0) },
                  { label: 'Presión máxima', value: `${simActiva.presion_max_mca ?? '—'} m.c.a`, color: 'var(--primary)' },
                  { label: 'Nodos críticos', value: `${simActiva.nodos_criticos ?? 0} / ${simActiva.nodos_total ?? 0}`, color: simActiva.nodos_criticos > 0 ? 'var(--danger)' : 'var(--success)' },
                ].map(({ label, value, color }) => (
                  <div key={label} className="card" style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 22, fontWeight: 800, color }}>{value}</div>
                    <div className="text-muted text-sm">{label}</div>
                  </div>
                ))}
              </div>

              {/* Leyenda de presiones */}
              <div className="card">
                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>Rangos de presión:</span>
                  {PRESION_COLORS.map(b => (
                    <div key={b.label} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11 }}>
                      <div style={{ width: 12, height: 12, borderRadius: '50%', background: b.color }} />
                      {b.label}
                    </div>
                  ))}
                </div>
              </div>

              {/* Tabs resultados */}
              <div className="card" style={{ padding: 0 }}>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div className="tabs" style={{ maxWidth: 300 }}>
                    <button className={`tab${activeTab === 'nodos' ? ' active' : ''}`} onClick={() => setActiveTab('nodos')}>
                      🔵 Nodos ({nodosOrdenados.length})
                    </button>
                    <button className={`tab${activeTab === 'tuberias' ? ' active' : ''}`} onClick={() => setActiveTab('tuberias')}>
                      〰 Tuberías ({tuberiasOrdenadas.length})
                    </button>
                  </div>
                  <span className="text-muted text-sm" style={{ marginLeft: 'auto' }}>
                    ⏱ Calculado en {simActiva.duracion_calculo_seg?.toFixed(2)}s · {simActiva.nombre}
                  </span>
                </div>

                <div className="table-wrapper" style={{ border: 'none', maxHeight: 400, overflowY: 'auto' }}>
                  {activeTab === 'nodos' ? (
                    <table>
                      <thead>
                        <tr>
                          <th>Código</th>
                          <th>Presión (m.c.a)</th>
                          <th>Cota piez. (m)</th>
                          <th>Estado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {nodosOrdenados.map(([codigo, res]) => (
                          <tr key={codigo}>
                            <td className="font-mono" style={{ fontSize: 12 }}>{codigo}</td>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <div style={{
                                  width: `${Math.min(100, (res.presion_mca / 50) * 100)}%`,
                                  maxWidth: 120, height: 6, borderRadius: 3,
                                  background: presionColor(res.presion_mca),
                                  minWidth: 4,
                                }} />
                                <span style={{ fontWeight: 600, color: presionColor(res.presion_mca) }}>
                                  {res.presion_mca}
                                </span>
                              </div>
                            </td>
                            <td className="text-muted">{res.cota_piezometrica}</td>
                            <td>
                              {res.presion_mca < 5 ? <span className="badge badge-danger">Crítica</span>
                                : res.presion_mca < 10 ? <span className="badge badge-warning">Baja</span>
                                : <span className="badge badge-success">OK</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <table>
                      <thead>
                        <tr>
                          <th>Código</th>
                          <th>Velocidad (m/s)</th>
                          <th>Caudal (L/s)</th>
                          <th>Estado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {tuberiasOrdenadas.map(([codigo, res]) => (
                          <tr key={codigo}>
                            <td className="font-mono" style={{ fontSize: 12 }}>{codigo}</td>
                            <td>
                              <span style={{ fontWeight: 600, color: res.velocidad_ms < 0.3 ? 'var(--warning)' : res.velocidad_ms > 2.5 ? 'var(--danger)' : 'var(--success)' }}>
                                {res.velocidad_ms}
                              </span>
                            </td>
                            <td className="text-muted">{res.caudal_lps}</td>
                            <td>
                              {res.velocidad_ms < 0.3 ? <span className="badge badge-warning">Baja</span>
                                : res.velocidad_ms > 2.5 ? <span className="badge badge-danger">Alta</span>
                                : <span className="badge badge-success">OK</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
