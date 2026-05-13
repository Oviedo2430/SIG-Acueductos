import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { authApi } from '../services/api'

export default function LoginPage() {
  const navigate = useNavigate()
  const login = useAuthStore((s) => s.login)
  const [form, setForm] = useState({ email: '', password: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      const { data } = await authApi.login(form.email, form.password)
      login(data.access_token, data.user)
      navigate('/mapa')
    } catch (err) {
      setError(err.response?.data?.detail || 'Credenciales incorrectas')
    } finally {
      setLoading(false)
    }
  }

  // Modo demo: entrar sin backend
  const handleDemo = () => {
    login('demo-token', { email: 'demo@acueducto.gov.co', nombre_completo: 'Demo Usuario', rol: 'admin' })
    navigate('/mapa')
  }

  return (
    <div className="login-page">
      <div className="login-card animate-fade">
        {/* Logo */}
        <div className="login-logo">
          <div className="login-logo-mark">💧</div>
          <div className="login-title">SIG-Acueducto</div>
          <div className="login-subtitle">Municipio de Labateca · Norte de Santander</div>
        </div>

        {/* Formulario */}
        <form className="login-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label required">Correo electrónico</label>
            <input
              id="login-email"
              type="email"
              className="form-control"
              placeholder="usuario@acueducto.gov.co"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label required">Contraseña</label>
            <input
              id="login-password"
              type="password"
              className="form-control"
              placeholder="••••••••"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
            />
          </div>

          {error && <div className="alert alert-danger">{error}</div>}

          <button id="login-submit" type="submit" className="btn btn-primary btn-lg w-full" disabled={loading}>
            {loading ? <span className="animate-spin">⟳</span> : '🔐'}&nbsp;
            {loading ? 'Iniciando sesión...' : 'Ingresar al sistema'}
          </button>
        </form>

        <div className="divider" />

        {/* Acceso demo */}
        <button id="login-demo" className="btn btn-outline w-full" onClick={handleDemo}>
          👁 Ingresar en modo demo (sin backend)
        </button>

        <p className="text-xs text-muted" style={{ textAlign: 'center', marginTop: '12px' }}>
          Sistema de Gestión de Acueducto v1.0
        </p>
      </div>
    </div>
  )
}
