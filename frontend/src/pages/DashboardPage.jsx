import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import ReactECharts from 'echarts-for-react'
import api from '../services/api'

// ── Paleta de colores para charts ────────────────────────────
const C = {
  primary:  '#0ea5e9',
  accent:   '#06b6d4',
  success:  '#22c55e',
  warning:  '#f59e0b',
  danger:   '#ef4444',
  muted:    '#4d6380',
  good:     '#22c55e',
  regular:  '#f59e0b',
  bad:      '#ef4444',
  critical: '#dc2626',
}

const ESTADO_COLORS = {
  Bueno: C.good, Regular: C.warning, Malo: C.bad, Critico: C.critical, Desconocido: C.muted,
}

const MATERIAL_COLORS = ['#0ea5e9','#06b6d4','#8b5cf6','#f59e0b','#ec4899','#10b981']

// ── Tema oscuro base para todos los charts ───────────────────
const baseStyle = {
  textStyle: { color: '#94a3b8', fontFamily: 'Inter, sans-serif' },
  tooltip:   { backgroundColor: '#1a2436', borderColor: '#2a3a52', textStyle: { color: '#f0f6ff' } },
  legend:    { textStyle: { color: '#94a3b8' }, pageTextStyle: { color: '#94a3b8' } },
}

// ── Helpers de opciones ECharts ───────────────────────────────
function makeDonut(data, title) {
  return {
    ...baseStyle,
    title: { text: title, textStyle: { color: '#f0f6ff', fontSize: 13, fontWeight: 600 }, top: 6, left: 10 },
    series: [{
      type: 'pie', radius: ['45%', '72%'], center: ['50%', '58%'],
      label: { color: '#94a3b8', fontSize: 11 },
      emphasis: { label: { fontSize: 13, fontWeight: 'bold' } },
      data: Object.entries(data).map(([name, value]) => ({
        name, value, itemStyle: { color: ESTADO_COLORS[name] || MATERIAL_COLORS[Object.keys(data).indexOf(name) % 6] },
      })),
    }],
    tooltip: { ...baseStyle.tooltip, trigger: 'item', formatter: '{b}: {c} ({d}%)' },
  }
}

function makeHBar(data, title, color = C.primary) {
  const names = Object.keys(data)
  const values = Object.values(data)
  return {
    ...baseStyle,
    title: { text: title, textStyle: { color: '#f0f6ff', fontSize: 13, fontWeight: 600 }, top: 6, left: 10 },
    grid: { left: '22%', right: '8%', top: 40, bottom: 20 },
    xAxis: { type: 'value', axisLine: { lineStyle: { color: '#2a3a52' } }, splitLine: { lineStyle: { color: '#1a2436' } }, axisLabel: { color: '#94a3b8', fontSize: 10 } },
    yAxis: { type: 'category', data: names, axisLabel: { color: '#94a3b8', fontSize: 11 } },
    series: [{ type: 'bar', data: values, barMaxWidth: 24, itemStyle: { color, borderRadius: [0, 4, 4, 0] } }],
    tooltip: { ...baseStyle.tooltip, trigger: 'axis' },
  }
}

function makeBar(data, title, colors) {
  const names = Object.keys(data)
  const values = Object.values(data)
  return {
    ...baseStyle,
    title: { text: title, textStyle: { color: '#f0f6ff', fontSize: 13, fontWeight: 600 }, top: 6, left: 10 },
    grid: { left: '6%', right: '4%', top: 45, bottom: 28 },
    xAxis: { type: 'category', data: names, axisLabel: { color: '#94a3b8', fontSize: 10 }, axisLine: { lineStyle: { color: '#2a3a52' } } },
    yAxis: { type: 'value', axisLabel: { color: '#94a3b8', fontSize: 10 }, splitLine: { lineStyle: { color: '#1a2436' } } },
    series: [{
      type: 'bar', data: values, barMaxWidth: 40,
      itemStyle: { borderRadius: [4, 4, 0, 0], color: (params) => (colors ? colors[params.dataIndex % colors.length] : C.primary) },
    }],
    tooltip: { ...baseStyle.tooltip, trigger: 'axis' },
  }
}

function makePresionBar(presiones) {
  const entries = Object.entries(presiones).sort((a, b) => a[1] - b[1])
  const names = entries.map(([k]) => k)
  const values = entries.map(([, v]) => v)
  const colors = values.map(v => v < 5 ? C.danger : v < 10 ? C.warning : v < 20 ? '#eab308' : v <= 35 ? C.success : C.primary)
  return {
    ...baseStyle,
    title: { text: 'Presión por nodo (m.c.a)', textStyle: { color: '#f0f6ff', fontSize: 13, fontWeight: 600 }, top: 6, left: 10 },
    grid: { left: '22%', right: '8%', top: 40, bottom: 20 },
    xAxis: { type: 'value', axisLabel: { color: '#94a3b8', fontSize: 10 }, splitLine: { lineStyle: { color: '#1a2436' } }, name: 'm.c.a', nameTextStyle: { color: '#94a3b8', fontSize: 10 } },
    yAxis: { type: 'category', data: names, axisLabel: { color: '#94a3b8', fontSize: 11 } },
    series: [{
      type: 'bar', data: values.map((v, i) => ({ value: v, itemStyle: { color: colors[i], borderRadius: [0, 4, 4, 0] } })),
      barMaxWidth: 22,
      label: { show: true, position: 'right', formatter: '{c}', color: '#94a3b8', fontSize: 10 },
    }],
    tooltip: { ...baseStyle.tooltip, trigger: 'axis', formatter: (p) => `${p[0].name}: <b>${p[0].value} m.c.a</b>` },
    markLine: { data: [{ xAxis: 10, lineStyle: { color: C.danger, type: 'dashed' } }] },
  }
}

function makeHistorial(historial) {
  const fechas = historial.map(s => s.fecha ? s.fecha.slice(0, 10) : '—')
  return {
    ...baseStyle,
    title: { text: 'Evolución de presiones en simulaciones', textStyle: { color: '#f0f6ff', fontSize: 13, fontWeight: 600 }, top: 6, left: 10 },
    legend: { ...baseStyle.legend, data: ['P. mínima', 'P. media', 'P. máxima'], top: 6, right: 10 },
    grid: { left: '6%', right: '4%', top: 45, bottom: 28 },
    xAxis: { type: 'category', data: fechas, axisLabel: { color: '#94a3b8', fontSize: 10 }, axisLine: { lineStyle: { color: '#2a3a52' } } },
    yAxis: { type: 'value', axisLabel: { color: '#94a3b8', fontSize: 10 }, splitLine: { lineStyle: { color: '#1a2436' } }, name: 'm.c.a', nameTextStyle: { color: '#94a3b8' } },
    series: [
      { name: 'P. mínima', type: 'line', data: historial.map(s => s.presion_min), smooth: true, lineStyle: { color: C.danger }, itemStyle: { color: C.danger }, areaStyle: { color: `${C.danger}22` } },
      { name: 'P. media',  type: 'line', data: historial.map(s => s.presion_media), smooth: true, lineStyle: { color: C.success }, itemStyle: { color: C.success }, areaStyle: { color: `${C.success}22` } },
      { name: 'P. máxima', type: 'line', data: historial.map(s => s.presion_max), smooth: true, lineStyle: { color: C.primary }, itemStyle: { color: C.primary }, areaStyle: { color: `${C.primary}22` } },
    ],
    tooltip: { ...baseStyle.tooltip, trigger: 'axis' },
  }
}

function makeGauge(score) {
  const color = score >= 80 ? C.success : score >= 60 ? C.warning : C.danger
  return {
    ...baseStyle,
    series: [{
      type: 'gauge', radius: '90%',
      startAngle: 200, endAngle: -20,
      min: 0, max: 100,
      pointer: { show: false },
      progress: { show: true, width: 18, itemStyle: { color } },
      axisLine: { lineStyle: { width: 18, color: [[1, '#1a2436']] } },
      axisTick: { show: false }, splitLine: { show: false }, axisLabel: { show: false },
      detail: {
        valueAnimation: true,
        formatter: '{value}',
        color, fontSize: 32, fontWeight: 'bold',
        offsetCenter: [0, '0%'],
      },
      title: { show: true, offsetCenter: [0, '30%'], color: '#94a3b8', fontSize: 12 },
      data: [{ value: score, name: 'Salud de la red' }],
    }],
  }
}

// ── Cálculo de score de salud de la red ──────────────────────
function calcHealthScore(stats) {
  if (!stats) return 75
  const total = Object.values(stats.estados_tuberias || {}).reduce((a, b) => a + b, 0) || 1
  const malos = (stats.estados_tuberias?.Malo || 0) + (stats.estados_tuberias?.Critico || 0)
  const pctMalos = malos / total
  const sim = stats.ultima_simulacion
  const pctCriticos = sim ? (sim.nodos_criticos || 0) / (sim.nodos_total || 1) : 0
  return Math.max(0, Math.round(100 - pctMalos * 50 - pctCriticos * 30))
}

// ── Componente de exportación ─────────────────────────────────
function ExportButton({ label, url, filename }) {
  const handleExport = async () => {
    try {
      const res = await api.get(url, { responseType: 'blob' })
      const href = URL.createObjectURL(res.data)
      const a = Object.assign(document.createElement('a'), { href, download: filename })
      a.click(); URL.revokeObjectURL(href)
    } catch {
      alert('Exportación no disponible — requiere backend activo')
    }
  }
  return <button className="btn btn-outline btn-sm" onClick={handleExport}>{label}</button>
}

// ── PÁGINA PRINCIPAL ──────────────────────────────────────────
export default function DashboardPage() {
  const [lastUpdate] = useState(new Date().toLocaleString('es-CO'))

  const { data: stats, isLoading, isError } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: () => api.get('/reportes/dashboard-stats').then(r => r.data),
    retry: false,
    refetchInterval: 60_000,
  })

  const healthScore = calcHealthScore(stats)

  if (isLoading) {
    return (
      <div className="page animate-fade">
        <div className="page-header"><h1 className="page-title">📊 Dashboard</h1></div>
        <div className="grid grid-4" style={{ marginBottom: '1rem' }}>
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="card"><div className="skeleton" style={{ height: 60 }} /></div>)}
        </div>
        <div className="grid grid-2">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="card"><div className="skeleton" style={{ height: 220 }} /></div>)}
        </div>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="page animate-fade">
        <div className="page-header"><h1 className="page-title">📊 Dashboard</h1></div>
        <div className="alert alert-warning" style={{ marginBottom: '1rem' }}>
          ⚠️ No se pudo conectar al backend. Mostrando datos de demostración.
        </div>
        <DashboardContent stats={DEMO_STATS_FE} healthScore={75} lastUpdate={lastUpdate} />
      </div>
    )
  }

  return (
    <div className="page animate-fade">
      <div className="page-header flex justify-between items-center">
        <div>
          <h1 className="page-title">📊 Dashboard de Red</h1>
          <p className="page-subtitle">
            {stats?.es_demo ? '⚠️ Datos de demostración — importe el shapefile para datos reales' : `Actualizado: ${lastUpdate}`}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <ExportButton label="📥 Tuberías Excel" url="/reportes/exportar/tuberias?formato=excel" filename="tuberias.xlsx" />
          <ExportButton label="📥 Nodos Excel" url="/reportes/exportar/nodos?formato=excel" filename="nodos.xlsx" />
          {stats?.ultima_simulacion?.id && (
            <ExportButton label="📥 Simulación" url={`/reportes/exportar/simulacion/${stats.ultima_simulacion.id}?formato=excel`} filename="simulacion.xlsx" />
          )}
        </div>
      </div>

      <DashboardContent stats={stats} healthScore={healthScore} lastUpdate={lastUpdate} />
    </div>
  )
}

function DashboardContent({ stats, healthScore }) {
  const red = stats?.red || {}
  const sim = stats?.ultima_simulacion
  const hasHistorial = (stats?.historial_simulaciones || []).length > 1
  const hasPresiones = Object.keys(stats?.presiones_nodos || {}).length > 0

  return (
    <>
      {/* KPI Row */}
      <div className="grid grid-4" style={{ marginBottom: '1.25rem' }}>
        {[
          { label: 'Tuberías', value: red.total_tuberias ?? '—', sub: red.km_red ? `${red.km_red} km de red` : 'en catastro', color: 'var(--layer-tuberias)' },
          { label: 'Nodos',    value: red.total_nodos ?? '—',    sub: `${red.total_valvulas ?? 0} válvulas`, color: 'var(--layer-nodos)' },
          { label: 'Daños / Fugas', value: red.total_danos ?? 0, sub: 'Reportes de mantenimiento', color: 'var(--danger)' },
          { label: 'Presión media', value: sim ? `${sim.presion_media} m` : '—', sub: sim ? `Última sim: ${sim.nombre}` : 'Sin simulación', color: 'var(--primary)' },
        ].map(({ label, value, sub, color }) => (
          <div key={label} className="card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 28, fontWeight: 800, color }}>{value}</div>
            <div style={{ fontWeight: 600, marginTop: 2 }}>{label}</div>
            <div className="text-muted text-xs" style={{ marginTop: 3 }}>{sub}</div>
          </div>
        ))}
      </div>

      {/* Fila 1: Gauge + Estado tuberías + Materiales */}
      <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
        <div className="card" style={{ padding: '0.75rem' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textAlign: 'center', marginBottom: 4 }}>Salud de la red</div>
          <ReactECharts option={makeGauge(healthScore)} style={{ height: 160 }} />
          <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-muted)' }}>
            {healthScore >= 80 ? '✅ Excelente' : healthScore >= 60 ? '⚠️ Regular' : '❌ Crítica'}
          </div>
        </div>
        <div className="card" style={{ padding: '0.75rem' }}>
          <ReactECharts
            option={makeDonut(stats?.estados_tuberias || { Bueno: 1 }, 'Estado de tuberías')}
            style={{ height: 210 }}
          />
        </div>
        <div className="card" style={{ padding: '0.75rem' }}>
          <ReactECharts
            option={makeHBar(stats?.materiales_tuberias || {}, 'Materiales', C.accent)}
            style={{ height: 210 }}
          />
        </div>
      </div>

      {/* Fila 2: Diámetros + Presiones por nodo */}
      <div className="grid grid-2" style={{ marginBottom: '1rem' }}>
        <div className="card" style={{ padding: '0.75rem' }}>
          <ReactECharts
            option={makeBar(stats?.diametros_tuberias || {}, 'Distribución por diámetro', MATERIAL_COLORS)}
            style={{ height: 220 }}
          />
        </div>
        <div className="card" style={{ padding: '0.75rem' }}>
          {hasPresiones ? (
            <ReactECharts option={makePresionBar(stats.presiones_nodos)} style={{ height: 220 }} />
          ) : (
            <div style={{ height: 220, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: '2rem', marginBottom: 8 }}>💧</div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>Sin datos de presión</div>
              <div style={{ fontSize: 12, marginTop: 4, textAlign: 'center' }}>Ejecute una simulación hidráulica<br />para ver la presión por nodo</div>
            </div>
          )}
        </div>
      </div>

      {/* Fila 3: Historial de simulaciones */}
      <div className="card" style={{ padding: '0.75rem', marginBottom: '1rem' }}>
        {hasHistorial ? (
          <ReactECharts option={makeHistorial(stats.historial_simulaciones)} style={{ height: 220 }} />
        ) : (
          <div style={{ height: 150, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', gap: 8 }}>
            <div style={{ fontSize: '1.5rem' }}>📈</div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>Historial de simulaciones</div>
            <div style={{ fontSize: 12 }}>Se mostrará aquí la evolución de presiones entre simulaciones</div>
          </div>
        )}
      </div>

      {/* Fila 4: Exportaciones */}
      <div className="card">
        <div className="card-title" style={{ marginBottom: 12 }}>📥 Exportar datos</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
          {[
            { label: '🗂 Tuberías CSV',  url: '/reportes/exportar/tuberias?formato=csv',  file: 'tuberias.csv' },
            { label: '🗂 Nodos CSV',     url: '/reportes/exportar/nodos?formato=csv',     file: 'nodos.csv' },
            { label: '🗂 Válvulas CSV',  url: '/reportes/exportar/valvulas?formato=csv',  file: 'valvulas.csv' },
            { label: '🗂 Daños CSV',     url: '/reportes/exportar/danos?formato=csv',     file: 'danos.csv' },
            { label: '📊 Tuberías Excel',url: '/reportes/exportar/tuberias?formato=excel',file: 'tuberias.xlsx' },
            { label: '📊 Nodos Excel',   url: '/reportes/exportar/nodos?formato=excel',   file: 'nodos.xlsx' },
            { label: '📊 Tanques Excel', url: '/reportes/exportar/tanques?formato=excel', file: 'tanques.xlsx' },
            { label: '📊 Daños Excel',   url: '/reportes/exportar/danos?formato=excel',   file: 'danos.xlsx' },
          ].map(({ label, url, file }) => (
            <ExportButton key={file} label={label} url={url} filename={file} />
          ))}
        </div>
      </div>
    </>
  )
}

// Demo data para uso sin backend
const DEMO_STATS_FE = {
  es_demo: true,
  red: { total_tuberias: 42, total_nodos: 35, total_valvulas: 8, total_tanques: 2, total_fuentes: 1, km_red: 3.8 },
  estados_tuberias: { Bueno: 25, Regular: 10, Malo: 5, Critico: 2 },
  materiales_tuberias: { PVC: 22, AC: 12, HF: 6, PE: 2 },
  diametros_tuberias: { '25mm': 5, '50mm': 18, '75mm': 12, '100mm': 5, '150mm': 2 },
  ultima_simulacion: { id: null, nombre: 'Demo', presion_min: 14.2, presion_max: 34.8, presion_media: 24.5, nodos_criticos: 1, nodos_total: 6 },
  historial_simulaciones: [],
  presiones_nodos: { 'NOD-001': 28.5, 'NOD-002': 24.3, 'NOD-003': 19.8, 'NOD-004': 22.1, 'NOD-005': 17.4, 'NOD-006': 14.2 },
}
