import { useState } from 'react'
import MapViewer from '../components/Map/MapViewer'
import { useMapStore, LAYERS } from '../store/mapStore'

export default function MapPage() {
  const [selectedFeature, setSelectedFeature] = useState(null)
  const [showColorPanel, setShowColorPanel] = useState(true)
  const [showLegend, setShowLegend] = useState(true)
  const { colorBy, setColorBy, drawnFeature } = useMapStore()

  return (
    <div style={{ position: 'relative', height: 'calc(100vh - var(--topbar-h))', width: '100%' }}>
      <MapViewer onFeatureClick={setSelectedFeature} />

      {/* Panel de control flotante (Colorear por) */}
      <div style={{
        position: 'absolute', top: 12, right: 52, zIndex: 10,
        background: 'var(--bg-card)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)', padding: showColorPanel ? '10px 14px' : '6px 14px',
        boxShadow: 'var(--shadow-lg)', minWidth: showColorPanel ? 180 : 'auto',
        transition: 'all 0.2s ease',
      }}>
        <div 
          onClick={() => setShowColorPanel(!showColorPanel)}
          style={{ 
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
            cursor: 'pointer', marginBottom: showColorPanel ? 6 : 0 
          }}
        >
          <div className="text-xs text-muted" style={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em' }}>
            Colorear por
          </div>
          <span style={{ fontSize: 10, opacity: 0.6 }}>{showColorPanel ? '▼' : '▲'}</span>
        </div>
        
        {showColorPanel && (
          <div style={{ marginTop: 8 }}>
            {[
              { value: 'none',     label: 'Sin coloración' },
              { value: 'estado',   label: 'Estado físico' },
              { value: 'material', label: 'Material' },
              { value: 'presion',  label: 'Presión (sim.)' },
            ].map(({ value, label }) => (
              <label key={value} style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 4, cursor: 'pointer', fontSize: 13 }}>
                <input type="radio" name="colorBy" value={value} checked={colorBy === value} onChange={() => setColorBy(value)} />
                {label}
              </label>
            ))}
          </div>
        )}
      </div>

      {/* Panel de feature seleccionado */}
      {selectedFeature && (
        <div style={{
          position: 'absolute', bottom: 24, left: 16, zIndex: 10,
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)', padding: '14px',
          boxShadow: 'var(--shadow-lg)', minWidth: 240, maxWidth: 320,
          animation: 'fadeIn .2s ease',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontWeight: 700, color: 'var(--primary)', fontSize: 13 }}>
              {LAYERS[selectedFeature._layer]?.icon} {selectedFeature.codigo || selectedFeature.nombre}
            </span>
            <button className="btn btn-ghost btn-sm" onClick={() => setSelectedFeature(null)}>✕</button>
          </div>
          {Object.entries(selectedFeature)
            .filter(([k]) => !['_layer', 'id'].includes(k))
            .map(([k, v]) => (
              <div key={k} className="map-popup-row" style={{ marginBottom: 5 }}>
                <span className="map-popup-key">{k}</span>
                <span className="map-popup-val">{v ?? '—'}</span>
              </div>
            ))
          }
          <button className="btn btn-outline btn-sm w-full" style={{ marginTop: 10 }}>✏️ Editar elemento</button>
        </div>
      )}

      {/* Panel de edición de nueva geometría (Draw) */}
      {drawnFeature && !selectedFeature && (
        <div style={{
          position: 'absolute', bottom: 24, left: 16, zIndex: 10,
          background: 'var(--bg-card)', border: '1px solid var(--primary)',
          borderRadius: 'var(--radius-md)', padding: '14px',
          boxShadow: 'var(--shadow-lg)', minWidth: 260, maxWidth: 320,
          animation: 'fadeIn .2s ease',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontWeight: 700, color: 'var(--primary)', fontSize: 13 }}>
              ✨ Nueva Geometría Dibujada
            </span>
          </div>
          <div className="text-xs text-muted mb-3">
            Tipo: <strong style={{color: 'var(--fg)'}}>{drawnFeature.geometry.type}</strong>
          </div>
          <div style={{ fontSize: 13, marginBottom: 10 }}>
            ¿Qué deseas hacer con este elemento?
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {drawnFeature.geometry.type === 'LineString' && (
              <button className="btn btn-primary btn-sm w-full">Crear Tubería</button>
            )}
            {drawnFeature.geometry.type === 'Point' && (
              <>
                <button className="btn btn-primary btn-sm w-full">Crear Nodo</button>
                <button className="btn btn-outline btn-sm w-full">Crear Válvula</button>
                <button className="btn btn-outline btn-sm w-full">Crear Tanque</button>
              </>
            )}
            {drawnFeature.geometry.type === 'Polygon' && (
              <button className="btn btn-primary btn-sm w-full">Seleccionar Área (Simulación)</button>
            )}
            <button className="btn btn-ghost btn-sm w-full" style={{marginTop: 4, color: 'var(--danger)'}}>Cancelar</button>
          </div>
        </div>
      )}

      {/* Leyenda */}
      <div style={{
        position: 'absolute', bottom: 24, right: 52, zIndex: 10,
        background: 'var(--bg-card)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)', padding: showLegend ? '10px 14px' : '6px 14px',
        boxShadow: 'var(--shadow-lg)',
        transition: 'all 0.2s ease',
      }}>
        <div 
          onClick={() => setShowLegend(!showLegend)}
          style={{ 
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
            cursor: 'pointer', marginBottom: showLegend ? 8 : 0, gap: 12
          }}
        >
          <div className="text-xs text-muted" style={{ fontWeight: 600 }}>Estado tuberías</div>
          <span style={{ fontSize: 10, opacity: 0.6 }}>{showLegend ? '▼' : '▲'}</span>
        </div>
        
        {showLegend && (
          <div style={{ marginTop: 8 }}>
            {[['Bueno','#22c55e'],['Regular','#f59e0b'],['Malo','#ef4444'],['Crítico','#dc2626']].map(([label, color]) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, fontSize: 12 }}>
                <div style={{ width: 24, height: 4, background: color, borderRadius: 2 }} />
                {label}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
