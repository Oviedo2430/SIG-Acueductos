import { useState } from 'react'
import MapViewer, { forceMapRefresh } from '../components/Map/MapViewer'
import { useMapStore, LAYERS } from '../store/mapStore'
import ElementForm from '../components/forms/ElementForm'
import { redApi } from '../services/api'

export default function MapPage() {
  const [selectedFeature, setSelectedFeature] = useState(null)
  const [showColorPanel, setShowColorPanel] = useState(true)
  const [showLegend, setShowLegend] = useState(true)
  const [creationType, setCreationType] = useState(null)
  const [isSaving, setIsSaving] = useState(false)
  
  const { colorBy, setColorBy, drawnFeature, setDrawnFeature } = useMapStore()

  const handleCreateElement = async (formData) => {
    try {
      setIsSaving(true)
      // Enviar a la base de datos a través de la API
      const payload = {
        ...formData,
        geom: drawnFeature.geometry
      }
      await redApi[creationType].create(payload)
      
      // Refrescar el mapa con la nueva información desde la base de datos
      forceMapRefresh(creationType)

      // Limpiar el estado de dibujo
      setCreationType(null)
      setDrawnFeature(null)
      useMapStore.getState().triggerDrawAction('trash', null)
      
    } catch (error) {
      console.error('Error al guardar:', error)
      alert('Ocurrió un error al guardar. Verifica la consola.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div style={{ position: 'relative', height: 'calc(100vh - var(--topbar-h))', width: '100%' }}>
      <MapViewer onFeatureClick={setSelectedFeature} />

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
            .filter(([k]) => !['_layer', 'id', '_id', '_geometry'].includes(k))
            .map(([k, v]) => (
              <div key={k} className="map-popup-row" style={{ marginBottom: 5 }}>
                <span className="map-popup-key">{k}</span>
                <span className="map-popup-val">{v ?? '—'}</span>
              </div>
            ))
          }
          <button 
            className="btn btn-outline btn-sm w-full" 
            style={{ marginTop: 10 }}
            onClick={() => useMapStore.getState().setFeatureToEdit(selectedFeature)}
          >
            ✏️ Editar elemento
          </button>
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
          {!creationType ? (
            <>
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
                  <button className="btn btn-primary btn-sm w-full" onClick={() => setCreationType('tuberias')}>Crear Tubería</button>
                )}
                {drawnFeature.geometry.type === 'Point' && (
                  <>
                    <button className="btn btn-primary btn-sm w-full" onClick={() => setCreationType('nodos')}>Crear Nodo</button>
                    <button className="btn btn-outline btn-sm w-full" onClick={() => setCreationType('fuentes')}>Crear Fuente</button>
                    <button className="btn btn-outline btn-sm w-full" onClick={() => setCreationType('valvulas')}>Crear Válvula</button>
                    <button className="btn btn-outline btn-sm w-full" onClick={() => setCreationType('tanques')}>Crear Tanque</button>
                    <button className="btn btn-outline btn-sm w-full" onClick={() => setCreationType('danos')} style={{ color: '#dc2626', borderColor: '#dc2626' }}>Crear Daño (Mantenimiento)</button>
                  </>
                )}
                {drawnFeature.geometry.type === 'Polygon' && (
                  <button className="btn btn-primary btn-sm w-full">Seleccionar Área (Simulación)</button>
                )}
                <button className="btn btn-ghost btn-sm w-full" style={{marginTop: 4, color: 'var(--danger)'}} onClick={() => {
                  useMapStore.getState().triggerDrawAction('trash', null)
                  useMapStore.getState().setDrawnFeature(null)
                }}>
                  Cancelar / Borrar
                </button>
              </div>
            </>
          ) : (
            <ElementForm
              layerType={creationType}
              isSaving={isSaving}
              onCancel={() => setCreationType(null)}
              onSubmit={handleCreateElement}
            />
          )}
        </div>
      )}

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

        {/* Leyenda Dinámica */}
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
            <div className="text-xs text-muted" style={{ fontWeight: 600 }}>
              {colorBy === 'estado' || colorBy === 'none' ? 'Estado Tuberías' : 
               colorBy === 'material' ? 'Material Tuberías' : 
               'Resultados (Simulación)'}
            </div>
            <span style={{ fontSize: 10, opacity: 0.6 }}>{showLegend ? '▼' : '▲'}</span>
          </div>
          
          {showLegend && (
            <div style={{ marginTop: 8 }}>
              {colorBy === 'estado' || colorBy === 'none' ? (
                [['Bueno','#22c55e'],['Regular','#f59e0b'],['Malo','#ef4444'],['Crítico','#dc2626']].map(([label, color]) => (
                  <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, fontSize: 12 }}>
                    <div style={{ width: 24, height: 4, background: color, borderRadius: 2 }} />
                    {label}
                  </div>
                ))
              ) : colorBy === 'material' ? (
                [['PVC','#3b82f6'],['Asbesto C. (AC)','#8b5cf6'],['Hierro F. (HF)','#64748b'],['Polietileno (PE)','#0ea5e9']].map(([label, color]) => (
                  <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, fontSize: 12 }}>
                    <div style={{ width: 24, height: 4, background: color, borderRadius: 2 }} />
                    {label}
                  </div>
                ))
              ) : (
                <>
                  <div style={{fontSize: 11, fontWeight: 'bold', marginBottom: 4, color: 'var(--text)'}}>Presión Nodos (mca)</div>
                  {[['< 5 (Baja)','#ef4444'],['5 - 10','#f97316'],['10 - 20','#eab308'],['20 - 35 (Óptima)','#22c55e'],['> 35 (Alta)','#3b82f6']].map(([label, color]) => (
                    <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, fontSize: 12 }}>
                      <div style={{ width: 12, height: 12, background: color, borderRadius: 6, flexShrink: 0 }} />
                      {label}
                    </div>
                  ))}
                  <div style={{fontSize: 11, fontWeight: 'bold', marginTop: 8, marginBottom: 4, color: 'var(--text)'}}>Velocidad Tuberías (m/s)</div>
                  {[['< 0.6 (Baja)','#f97316'],['0.6 - 1.5 (Óptima)','#22c55e'],['> 1.5 (Alta)','#ef4444']].map(([label, color]) => (
                    <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, fontSize: 12 }}>
                      <div style={{ width: 24, height: 4, background: color, borderRadius: 2, flexShrink: 0 }} />
                      {label}
                    </div>
                  ))}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
