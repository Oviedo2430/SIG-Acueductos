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

        {/* Herramientas de Dibujo */}
        <div className="nav-section-label" style={{ padding: '0 2px', marginBottom: '8px', marginTop: '12px' }}>
          Herramientas de Dibujo
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '0 4px' }}>
          <button className="btn btn-outline btn-sm" onClick={() => useMapStore.getState().triggerDrawAction('mode', 'draw_point')} style={{ justifyContent: 'flex-start', background: 'transparent' }}>
            📍 Punto
          </button>
          <button className="btn btn-outline btn-sm" onClick={() => useMapStore.getState().triggerDrawAction('mode', 'draw_line_string')} style={{ justifyContent: 'flex-start', background: 'transparent' }}>
            📏 Línea
          </button>
          <button className="btn btn-outline btn-sm" onClick={() => useMapStore.getState().triggerDrawAction('mode', 'draw_polygon')} style={{ justifyContent: 'flex-start', background: 'transparent' }}>
            ⬟ Polígono
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => useMapStore.getState().triggerDrawAction('trash', null)} style={{ color: 'var(--danger)', justifyContent: 'flex-start' }}>
            🗑️ Borrar selección
          </button>
        </div>

        <div className="divider" style={{ marginTop: '12px' }} />

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
        <div className="text-xs text-muted" style={{ marginBottom: 12 }}>
          Diseñado y Desarrollado por:
        </div>
        <a href="https://www.senseiconsultoria.com" target="_blank" rel="noopener noreferrer" style={{ display: 'inline-block', transition: 'all 0.2s' }} onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.05)'; e.currentTarget.style.filter = 'brightness(1.2)' }} onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.filter = 'none' }}>
          <img src="/logo-sensei.png" alt="SENSEI Consultoría y Comunicaciones" style={{ maxWidth: '140px', height: 'auto', display: 'block', margin: '0 auto', filter: 'drop-shadow(0px 0px 12px rgba(255, 255, 255, 0.4)) drop-shadow(0px 0px 4px rgba(255, 255, 255, 0.6))' }} />
        </a>
      </div>
    </aside>
  )
}
