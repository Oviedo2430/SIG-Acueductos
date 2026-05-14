import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useReactTable, getCoreRowModel, getSortedRowModel, getFilteredRowModel, flexRender } from '@tanstack/react-table'
import api, { importApi } from '../services/api'
import { LAYERS } from '../store/mapStore'

// ── Configuración de columnas por capa ───────────────────────
const COLUMNS_MAP = {
  tuberias: [
    { accessorKey: 'codigo',      header: 'Código',       size: 90  },
    { accessorKey: 'diametro_mm', header: 'Diám. (mm)',   size: 90  },
    { accessorKey: 'material',    header: 'Material',     size: 90  },
    { accessorKey: 'rugosidad_hw',header: 'HW',           size: 60  },
    { accessorKey: 'year_instalacion', header: 'Año',     size: 70  },
    { accessorKey: 'estado',      header: 'Estado',       size: 90, cell: EstadoCell },
    { accessorKey: 'zona_presion',header: 'Zona',         size: 90  },
    { accessorKey: 'sector',      header: 'Sector',       size: 90  },
  ],
  nodos: [
    { accessorKey: 'codigo',           header: 'Código',         size: 90 },
    { accessorKey: 'tipo',             header: 'Tipo',           size: 90 },
    { accessorKey: 'cota_msnm',        header: 'Cota (m.s.n.m)', size: 110 },
    { accessorKey: 'demanda_base_lps', header: 'Demanda (L/s)',  size: 110 },
    { accessorKey: 'tipo_usuario',     header: 'Tipo usuario',   size: 110 },
    { accessorKey: 'num_usuarios',     header: 'N° usuarios',    size: 100 },
    { accessorKey: 'estado',           header: 'Estado',         size: 90, cell: EstadoCell },
  ],
  valvulas: [
    { accessorKey: 'codigo',          header: 'Código',       size: 90 },
    { accessorKey: 'tipo',            header: 'Tipo',         size: 70 },
    { accessorKey: 'estado',          header: 'Estado',       size: 90, cell: EstadoCell },
    { accessorKey: 'diametro_mm',     header: 'Diám. (mm)',   size: 90 },
    { accessorKey: 'cota_msnm',       header: 'Cota (m)',     size: 90 },
    { accessorKey: 'presion_setting',  header: 'P. setting',   size: 90 },
  ],
  tanques: [
    { accessorKey: 'codigo',          header: 'Código',       size: 90 },
    { accessorKey: 'nombre',          header: 'Nombre',       size: 140 },
    { accessorKey: 'cota_fondo_msnm', header: 'Cota fondo',   size: 100 },
    { accessorKey: 'cota_techo_msnm', header: 'Cota techo',   size: 100 },
    { accessorKey: 'capacidad_m3',    header: 'Cap. (m³)',    size: 90 },
    { accessorKey: 'estado',          header: 'Estado',       size: 90, cell: EstadoCell },
  ],
  fuentes: [
    { accessorKey: 'codigo',                  header: 'Código',         size: 90 },
    { accessorKey: 'nombre',                  header: 'Nombre',         size: 140 },
    { accessorKey: 'tipo',                    header: 'Tipo',           size: 90 },
    { accessorKey: 'cota_piezometrica_msnm',  header: 'Cota piez. (m)', size: 120 },
    { accessorKey: 'caudal_disponible_lps',   header: 'Caudal (L/s)',   size: 110 },
    { accessorKey: 'estado',                  header: 'Estado',         size: 90, cell: EstadoCell },
  ],
  danos: [
    { accessorKey: 'codigo',                 header: 'Código',         size: 90 },
    { accessorKey: 'tipo_dano',              header: 'Tipo de daño',   size: 130 },
    { accessorKey: 'severidad',              header: 'Severidad',      size: 90 },
    { accessorKey: 'estado_reparacion',      header: 'Reparación',     size: 100, cell: EstadoCell },
    { accessorKey: 'costo_reparacion',       header: 'Costo ($)',      size: 90 },
    { accessorKey: 'volumen_perdido_est_m3', header: 'Vol. perdido',   size: 100 },
  ],
}

const ESTADO_COLORS = {
  Bueno: 'var(--success)', Regular: 'var(--warning)', Malo: 'var(--danger)',
  Critico: '#dc2626', Activo: 'var(--success)', Inactivo: 'var(--text-muted)',
  Abierta: 'var(--success)', Cerrada: 'var(--danger)', Operativo: 'var(--success)',
  Activa: 'var(--success)',
  Pendiente: 'var(--danger)', 'En progreso': 'var(--warning)', Reparado: 'var(--success)'
}

function EstadoCell({ getValue }) {
  const v = getValue()
  const color = ESTADO_COLORS[v] || 'var(--text-muted)'
  return <span style={{ color, fontWeight: 600 }}>● {v || '—'}</span>
}

const LAYER_ORDER = ['tuberias', 'nodos', 'valvulas', 'tanques', 'fuentes', 'danos']

export default function CatastroPage() {
  const qc = useQueryClient()
  const [activeLayer, setActiveLayer] = useState('tuberias')
  const [globalFilter, setGlobalFilter] = useState('')
  const [sorting, setSorting] = useState([])
  const [page, setPage] = useState(1)
  const [showImport, setShowImport] = useState(false)
  const [editItem, setEditItem] = useState(null)

  // ── Cargar datos del layer activo ─────────────────────────
  const { data, isLoading, isError } = useQuery({
    queryKey: ['catastro', activeLayer, page],
    queryFn: () => api.get(`/${activeLayer}`, { params: { page, limit: 50 } }).then(r => r.data),
    retry: false,
  })

  const { data: stats } = useQuery({
    queryKey: ['red-stats'],
    queryFn: () => api.get('/red/stats').then(r => r.data),
    retry: false,
  })

  // ── Mutation de edición ───────────────────────────────────
  const editMutation = useMutation({
    mutationFn: ({ id, payload }) => api.put(`/${activeLayer}/${id}`, payload),
    onSuccess: () => { qc.invalidateQueries(['catastro', activeLayer]); setEditItem(null) },
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/${activeLayer}/${id}`),
    onSuccess: () => qc.invalidateQueries(['catastro', activeLayer]),
  })

  // ── Tabla TanStack ────────────────────────────────────────
  const columns = [
    ...(COLUMNS_MAP[activeLayer] || []),
    {
      id: 'acciones',
      header: 'Acciones',
      size: 100,
      cell: ({ row }) => (
        <div style={{ display: 'flex', gap: 4 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => setEditItem(row.original)} title="Editar">✏️</button>
          <button
            className="btn btn-danger btn-sm"
            onClick={() => { if (window.confirm('¿Eliminar este elemento?')) deleteMutation.mutate(row.original.id) }}
            title="Eliminar"
          >🗑</button>
        </div>
      ),
    },
  ]

  const table = useReactTable({
    data: data?.data || [],
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    manualPagination: true,
    pageCount: data ? Math.ceil(data.total / 50) : 0,
  })

  const totalPages = data ? Math.ceil(data.total / 50) : 1

  return (
    <div className="page animate-fade" style={{ height: 'calc(100vh - var(--topbar-h))', overflowY: 'auto' }}>
      {/* Header */}
      <div className="page-header flex justify-between items-center">
        <div>
          <h1 className="page-title">📋 Catastro de Red</h1>
          <p className="page-subtitle">Gestión de elementos de la red de acueducto</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-outline" onClick={() => setShowImport(true)}>📥 Importar .ZIP (Shapefile)</button>
          <button className="btn btn-outline" onClick={() => setShowImport(true)} style={{ borderColor: 'var(--primary)', color: 'var(--primary)' }}>💧 Importar .INP (EPANET)</button>
          <a href="/guia-shapefile" className="btn btn-ghost">📐 Guía de campos</a>
        </div>
      </div>

      {/* Stats por capa */}
      <div className="grid grid-4" style={{ marginBottom: '1.25rem' }}>
        {LAYER_ORDER.map(lid => (
          <div
            key={lid}
            className="card"
            style={{
              cursor: 'pointer', textAlign: 'center',
              border: `1px solid ${activeLayer === lid ? LAYERS[lid].color : 'var(--border)'}`,
              background: activeLayer === lid ? `${LAYERS[lid].color}11` : 'var(--bg-card)',
              transition: 'all .15s',
            }}
            onClick={() => { setActiveLayer(lid); setPage(1); setGlobalFilter('') }}
          >
            <div style={{ fontSize: 22, fontWeight: 800, color: LAYERS[lid].color }}>
              {stats ? (stats[lid] ?? '—') : <span className="skeleton" style={{ width: 30, height: 24, display: 'inline-block' }} />}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{LAYERS[lid].label}</div>
          </div>
        ))}
        {/* stats tiene 5 items pero grid-4 → la 5a queda en nueva fila, está bien */}
      </div>

      {/* Barra de filtros */}
      <div style={{ display: 'flex', gap: 8, marginBottom: '0.75rem', alignItems: 'center' }}>
        <input
          className="form-control"
          style={{ maxWidth: 320 }}
          placeholder={`Buscar en ${LAYERS[activeLayer]?.label}...`}
          value={globalFilter}
          onChange={e => setGlobalFilter(e.target.value)}
        />
        {data && (
          <span className="text-muted text-sm">{data.total} registros</span>
        )}
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => api.get(`/${activeLayer}/exportar`, { params: { formato: 'excel' }, responseType: 'blob' })
            .then(r => {
              const url = URL.createObjectURL(r.data)
              Object.assign(document.createElement('a'), { href: url, download: `${activeLayer}.xlsx` }).click()
            }).catch(() => alert('Exportación no disponible aún'))
          }
          style={{ marginLeft: 'auto' }}
        >
          📥 Exportar Excel
        </button>
      </div>

      {/* Tabla */}
      {isError ? (
        <div className="alert alert-warning">
          ⚠️ No se pudo conectar al backend. Verifica que el servidor FastAPI esté corriendo en <code>http://localhost:8000</code>.
          <br /><span style={{ fontSize: 12 }}>En modo demo, los datos del mapa son de ejemplo. La tabla requiere el backend activo.</span>
        </div>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          <div className="table-wrapper" style={{ border: 'none' }}>
            <table>
              <thead>
                {table.getHeaderGroups().map(hg => (
                  <tr key={hg.id}>
                    {hg.headers.map(h => (
                      <th key={h.id} style={{ width: h.column.columnDef.size, cursor: h.column.getCanSort() ? 'pointer' : 'default' }}
                        onClick={h.column.getToggleSortingHandler()}>
                        {flexRender(h.column.columnDef.header, h.getContext())}
                        {h.column.getIsSorted() === 'asc' ? ' ↑' : h.column.getIsSorted() === 'desc' ? ' ↓' : ''}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody>
                {isLoading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i}>
                      {columns.map((_, j) => (
                        <td key={j}><div className="skeleton" style={{ height: 14, borderRadius: 3 }} /></td>
                      ))}
                    </tr>
                  ))
                ) : table.getRowModel().rows.length === 0 ? (
                  <tr><td colSpan={columns.length} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                    <div style={{ fontSize: '2rem', marginBottom: 8 }}>📂</div>
                    <div style={{ fontWeight: 600, marginBottom: 4 }}>Sin datos en esta capa</div>
                    <div style={{ fontSize: 12 }}>Importe el shapefile para ver los elementos de la red</div>
                    <button className="btn btn-primary btn-sm" style={{ marginTop: 12 }} onClick={() => setShowImport(true)}>📥 Importar ahora</button>
                  </td></tr>
                ) : (
                  table.getRowModel().rows.map(row => (
                    <tr key={row.id}>
                      {row.getVisibleCells().map(cell => (
                        <td key={cell.id} style={{ maxWidth: cell.column.columnDef.size, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {flexRender(cell.column.columnDef.cell, cell.getContext()) ?? '—'}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Paginación */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', borderTop: '1px solid var(--border)' }}>
              <button className="btn btn-ghost btn-sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>← Anterior</button>
              <span className="text-muted text-sm">Página {page} de {totalPages}</span>
              <button className="btn btn-ghost btn-sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Siguiente →</button>
            </div>
          )}
        </div>
      )}

      {/* ── Modal de importación ─────────────────────────── */}
      {showImport && <ImportModal onClose={() => setShowImport(false)} defaultLayer={activeLayer} />}

      {/* ── Modal de edición ─────────────────────────────── */}
      {editItem && (
        <EditModal
          item={editItem}
          layer={activeLayer}
          onClose={() => setEditItem(null)}
          onSave={(payload) => editMutation.mutate({ id: editItem.id, payload })}
          isSaving={editMutation.isPending}
          error={editMutation.error?.response?.data?.detail}
        />
      )}
    </div>
  )
}


// ── Modal de importación ──────────────────────────────────────
function ImportModal({ onClose, defaultLayer }) {
  const [tipo, setTipo] = useState(defaultLayer)
  const [file, setFile] = useState(null)
  const [dragOver, setDragOver] = useState(false)
  const [estado, setEstado] = useState(null)
  const inputRef = useRef()

  const [isEpanet, setIsEpanet] = useState(false)

  const handleFile = (f) => {
    if (f?.name.endsWith('.inp')) {
      setIsEpanet(true)
      setFile(f)
      setEstado(null)
      return
    }
    if (f?.name.endsWith('.zip')) {
      setIsEpanet(false)
      setFile(f)
      setEstado(null)
      return
    }
    setEstado({ tipo: 'error', msg: 'Solo archivos .zip (Shapefile) o .inp (EPANET)' })
  }

  const handleImport = async () => {
    if (!file) return
    setEstado({ tipo: 'loading', msg: 'Procesando archivo...' })
    try {
      const fd = new FormData(); fd.append('file', file)
      const { data } = isEpanet 
        ? await importApi.uploadEpanet(fd)
        : await importApi.uploadShapefile(tipo, fd)
        
      if (isEpanet) {
        setEstado({ tipo: 'success', msg: `✅ ${data.registros_importados} elementos importados desde EPANET.` })
      } else {
        setEstado({ tipo: 'success', msg: `✅ ${data.registros_importados} registros importados. ${data.total_errores > 0 ? `${data.total_errores} con errores.` : ''}` })
      }
      setFile(null)
    } catch (e) {
      setEstado({ tipo: 'error', msg: `❌ ${e.response?.data?.detail || 'Error al importar'}` })
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }} onClick={onClose}>
      <div className="card animate-fade" style={{ width: '100%', maxWidth: 520 }} onClick={e => e.stopPropagation()}>
        <div className="card-header">
          <div className="card-title">📥 Importar Archivo a la Red</div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>

        <div className="alert alert-info" style={{ marginBottom: '1rem', fontSize: 12 }}>
          ℹ️ <strong>Para Shapefiles:</strong> Sube un <strong>.zip</strong> (contiene .shp, .dbf, .shx, .prj) y selecciona la capa.<br/>
          ℹ️ <strong>Para EPANET:</strong> Sube directamente el archivo <strong>.inp</strong>. Se importarán <strong>todas</strong> las capas (Nodos, Tuberías, Tanques, etc.) automáticamente.<br/>
          <em>Asegúrate de que las coordenadas estén en EPSG:9377 (MAGNA-SIRGAS CTM12).</em>
        </div>

        {!isEpanet && file?.name.endsWith('.zip') && (
          <div className="form-group" style={{ marginBottom: '1rem' }}>
            <label className="form-label">Tipo de capa (Shapefile)</label>
            <select className="form-control" value={tipo} onChange={e => setTipo(e.target.value)}>
              {Object.entries(LAYERS).filter(([id]) => id !== 'danos').map(([id, l]) => <option key={id} value={id}>{l.label}</option>)}
            </select>
          </div>
        )}

        <div
          className={`upload-zone${dragOver ? ' drag-over' : ''}`}
          style={{ marginBottom: '1rem' }}
          onDragOver={e => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={e => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files[0]) }}
          onClick={() => inputRef.current.click()}
        >
          <input ref={inputRef} type="file" accept=".zip,.inp" style={{ display: 'none' }} onChange={e => handleFile(e.target.files[0])} />
          <div className="upload-zone-icon">{isEpanet ? '💧' : '📦'}</div>
          {file
            ? <><div style={{ fontWeight: 600, color: 'var(--primary)' }}>{file.name}</div><div className="upload-zone-hint">{(file.size / 1024).toFixed(0)} KB</div></>
            : <><div className="upload-zone-text">Arrastra el .zip o .inp aquí o haz clic</div><div className="upload-zone-hint">Archivos .zip (Shape) o .inp (EPANET) · Máx. 50 MB</div></>
          }
        </div>

        {estado && (
          <div className={`alert ${estado.tipo === 'success' ? 'alert-success' : estado.tipo === 'error' ? 'alert-danger' : 'alert-info'}`} style={{ marginBottom: '1rem' }}>
            {estado.tipo === 'loading' && <span className="animate-spin">⟳</span>} {estado.msg}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn btn-ghost" onClick={onClose}>Cerrar</button>
          <button className="btn btn-primary" onClick={handleImport} disabled={!file || estado?.tipo === 'loading'}>
            {estado?.tipo === 'loading' ? '⟳ Importando...' : '📥 Importar'}
          </button>
        </div>
      </div>
    </div>
  )
}


// ── Modal de edición genérico ─────────────────────────────────
function EditModal({ item, layer, onClose, onSave, isSaving, error }) {
  const [form, setForm] = useState({ ...item })
  const editableFields = Object.keys(COLUMNS_MAP[layer] || [])
    .map(i => COLUMNS_MAP[layer][i]?.accessorKey)
    .filter(k => k && k !== 'id' && !k.includes('fecha') && k !== 'geom')

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }} onClick={onClose}>
      <div className="card animate-fade" style={{ width: '100%', maxWidth: 540, maxHeight: '80vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        <div className="card-header">
          <div className="card-title">✏️ Editar: {item.codigo || item.nombre || `ID ${item.id}`}</div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
          {editableFields.filter(Boolean).map(field => {
            const colDef = COLUMNS_MAP[layer]?.find(c => c.accessorKey === field)
            return (
              <div key={field} className="form-group">
                <label className="form-label">{colDef?.header || field}</label>
                <input
                  className="form-control"
                  value={form[field] ?? ''}
                  onChange={e => setForm({ ...form, [field]: e.target.value })}
                />
              </div>
            )
          })}
        </div>

        {error && <div className="alert alert-danger" style={{ marginBottom: '1rem' }}>{error}</div>}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={() => onSave(form)} disabled={isSaving}>
            {isSaving ? '⟳ Guardando...' : '💾 Guardar cambios'}
          </button>
        </div>
      </div>
    </div>
  )
}
