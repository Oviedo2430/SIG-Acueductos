import { NavLink } from 'react-router-dom'
import { useMapStore, LAYERS } from '../../store/mapStore'
import { useAuthStore } from '../../store/authStore'

const NAV_ITEMS = [
  { to: '/mapa',           icon: '🗺️',  label: 'Visor GIS',       roles: null },
  { to: '/catastro',       icon: '📋',  label: 'Catastro de Red', roles: null },
  { to: '/simulacion',     icon: '💧',  label: 'Simulación WNTR', roles: null },
  { to: '/dashboard',      icon: '📊',  label: 'Dashboard',       roles: null },
  { to: '/guia-shapefile', icon: '📐',  label: 'Guía Shapefile',  roles: null },
  { to: '/admin',          icon: '👥',  label: 'Usuarios',        roles: ['admin'] },
]

export default function Sidebar() {
  const { visibleLayers, toggleLayer } = useMapStore()
  const user = useAuthStore(s => s.user)
  const navItems = NAV_ITEMS.filter(item => !item.roles || item.roles.includes(user?.rol))

  return (
    <aside className="sidebar">
      {/* Navegación */}
      <div className="nav-section">
        <div className="nav-section-label">Módulos</div>
        {navItems.map(({ to, icon, label }) => (
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
      <div className="layer-section" style={{ flexGrow: 1 }}>
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

      {/* Footer Sensei */}
      <div style={{ padding: '16px', textAlign: 'center', borderTop: '1px solid var(--border)' }}>
        <div className="text-xs text-muted" style={{ marginBottom: 8 }}>
          Diseñado y Desarrollado por:
        </div>
        <a href="https://www.senseiconsultoria.com" target="_blank" rel="noopener noreferrer" style={{ display: 'inline-block', opacity: 0.9, transition: 'opacity 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.opacity = '1'} onMouseLeave={(e) => e.currentTarget.style.opacity = '0.9'}>
          <img src="/logo-sensei.png" alt="SENSEI Consultoría y Comunicaciones" style={{ maxWidth: '140px', height: 'auto', display: 'block', margin: '0 auto' }} />
        </a>
      </div>
    </aside>
  )
}
