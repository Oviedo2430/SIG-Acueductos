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

      {/* Contenedor Flex para los paneles de control de la derecha */}
      <div style={{
        position: 'absolute', bottom: 30, right: 12, zIndex: 10,
        display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'flex-end'
      }}>
        
        {/* Panel de control flotante (Colorear por) */}
        <div style={{
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)', padding: showColorPanel ? '10px 14px' : '6px 14px',
          boxShadow: 'var(--shadow-lg)', minWidth: showColorPanel ? 180 : 'auto',
          transition: 'all 0.2s ease',
        }}>
          <div 
            onClick={() => setShowColorPanel(!showColorPanel)}
            style={{ 
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
              cursor: 'pointer', marginBottom: showColorPanel ? 6 : 0, gap: 12
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

        {/* Leyenda */}
        <div style={{
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)', padding: showLegend ? '10px 14px' : '6px 14px',
          boxShadow: 'var(--shadow-lg)', width: '100%',
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
    </div>
  )
}
