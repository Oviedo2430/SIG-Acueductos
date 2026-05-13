import { NavLink } from 'react-router-dom'
import { useMapStore, LAYERS } from '../../store/mapStore'

const NAV_ITEMS = [
  { to: '/mapa',           icon: '🗺️',  label: 'Visor GIS' },
  { to: '/catastro',       icon: '📋',  label: 'Catastro de Red' },
  { to: '/dashboard',      icon: '📊',  label: 'Dashboard' },
  { to: '/guia-shapefile', icon: '📐',  label: 'Guía Shapefile' },
]

export default function Sidebar() {
  const { visibleLayers, toggleLayer } = useMapStore()

  return (
    <aside className="sidebar">
      {/* Navegación */}
      <div className="nav-section">
        <div className="nav-section-label">Módulos</div>
        {NAV_ITEMS.map(({ to, icon, label }) => (
          <NavLink
            key={to} to={to}
            className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
          >
            <span className="nav-icon">{icon}</span>
            {label}
          </NavLink>
        ))}
      </div>

      {/* Panel de capas */}
      <div className="layer-section">
        <div className="nav-section-label" style={{ padding: '0 2px', marginBottom: '8px' }}>
          Capas de Red
        </div>
        {Object.values(LAYERS).map((layer) => (
          <div key={layer.id} className="layer-item" onClick={() => toggleLayer(layer.id)}>
            <div className="layer-dot" style={{ background: layer.color, opacity: visibleLayers[layer.id] ? 1 : .3 }} />
            <span className="layer-label" style={{ color: visibleLayers[layer.id] ? 'var(--text-primary)' : 'var(--text-muted)' }}>
              {layer.icon} {layer.label}
            </span>
            <label className="layer-toggle" onClick={e => e.stopPropagation()}>
              <input type="checkbox" checked={visibleLayers[layer.id]} onChange={() => toggleLayer(layer.id)} />
              <span className="layer-toggle-slider" />
            </label>
          </div>
        ))}

        <div className="divider" />

        {/* Info de la red */}
        <div style={{ padding: '4px 8px' }}>
          <div className="text-xs text-muted" style={{ marginBottom: 6 }}>Red activa</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            📍 Labateca, N. de Santander<br />
            🌐 SIRGAS CTM-12 → WGS84
          </div>
        </div>
      </div>
    </aside>
  )
}
