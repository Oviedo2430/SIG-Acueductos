import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import Sidebar from './Sidebar'

export default function Layout() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()

  const handleLogout = () => { logout(); navigate('/login') }
  const initials = user?.nombre_completo?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || 'U'

  return (
    <div className="app-shell">
      {/* ── Top bar ─────────────────────────────────── */}
      <header className="topbar">
        <div className="topbar-logo">
          <span style={{ fontSize: '1.3rem' }}>💧</span>
          <span>SIG-Acueducto <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>Labateca</span></span>
        </div>
        <div className="topbar-spacer" />
        <nav className="topbar-nav">
          {[
            { to: '/mapa',      label: 'Mapa' },
            { to: '/catastro',  label: 'Catastro' },
            { to: '/dashboard', label: 'Dashboard' },
          ].map(({ to, label }) => (
            <NavLink key={to} to={to} className={({ isActive }) => `btn btn-ghost btn-sm${isActive ? ' active' : ''}`}>
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="topbar-user">
          <span className="text-muted text-sm">{user?.email}</span>
          <div className="topbar-avatar" title={user?.nombre_completo}>{initials}</div>
          <button className="btn btn-ghost btn-sm" onClick={handleLogout} title="Cerrar sesión">⎋</button>
        </div>
      </header>

      {/* ── Sidebar ──────────────────────────────────── */}
      <Sidebar />

      {/* ── Contenido principal ──────────────────────── */}
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  )
}
