import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../services/api'
import { useAuthStore } from '../store/authStore'

const ROLES = ['admin', 'operador', 'tecnico', 'visualizador']
const ROL_LABELS = { admin: 'Administrador', operador: 'Operador', tecnico: 'Técnico', visualizador: 'Visualizador' }
const ROL_COLORS = { admin: 'var(--danger)', operador: 'var(--primary)', tecnico: 'var(--warning)', visualizador: 'var(--text-muted)' }

function RolBadge({ rol }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 9px', borderRadius: 99, fontSize: 11, fontWeight: 700,
      background: `${ROL_COLORS[rol]}22`, color: ROL_COLORS[rol],
    }}>
      {ROL_LABELS[rol] || rol}
    </span>
  )
}

const FORM_EMPTY = { email: '', nombre_completo: '', rol: 'visualizador', password: '' }

export default function AdminPage() {
  const qc = useQueryClient()
  const currentUser = useAuthStore(s => s.user)
  const [showForm, setShowForm] = useState(false)
  const [editUser, setEditUser] = useState(null)  // {id, ...} para editar
  const [form, setForm] = useState(FORM_EMPTY)
  const [formError, setFormError] = useState('')

  // ── Queries ──────────────────────────────────────────────
  const { data: usuarios = [], isLoading } = useQuery({
    queryKey: ['usuarios'],
    queryFn: () => api.get('/usuarios').then(r => r.data),
  })

  // ── Mutations ────────────────────────────────────────────
  const crearMutation = useMutation({
    mutationFn: (data) => api.post('/usuarios', data),
    onSuccess: () => { qc.invalidateQueries(['usuarios']); resetForm() },
    onError: (e) => setFormError(e.response?.data?.detail || 'Error al crear usuario'),
  })

  const editarMutation = useMutation({
    mutationFn: ({ id, data }) => api.put(`/usuarios/${id}`, data),
    onSuccess: () => { qc.invalidateQueries(['usuarios']); resetForm() },
    onError: (e) => setFormError(e.response?.data?.detail || 'Error al actualizar'),
  })

  const desactivarMutation = useMutation({
    mutationFn: (id) => api.delete(`/usuarios/${id}`),
    onSuccess: () => qc.invalidateQueries(['usuarios']),
  })

  // ── Handlers ─────────────────────────────────────────────
  const resetForm = () => { setForm(FORM_EMPTY); setEditUser(null); setShowForm(false); setFormError('') }

  const openEdit = (u) => {
    setEditUser(u)
    setForm({ email: u.email, nombre_completo: u.nombre_completo || '', rol: u.rol, password: '' })
    setShowForm(true)
    setFormError('')
  }

  const handleSubmit = (e) => {
    e.preventDefault(); setFormError('')
    if (editUser) {
      const payload = { nombre_completo: form.nombre_completo, rol: form.rol }
      if (form.password) payload.password = form.password
      editarMutation.mutate({ id: editUser.id, data: payload })
    } else {
      crearMutation.mutate(form)
    }
  }

  const isPending = crearMutation.isPending || editarMutation.isPending

  return (
    <div className="page animate-fade">
      {/* Header */}
      <div className="page-header flex justify-between items-center">
        <div>
          <h1 className="page-title">👥 Administración de Usuarios</h1>
          <p className="page-subtitle">Gestión de acceso y roles al sistema SIG-Acueducto</p>
        </div>
        <button id="btn-nuevo-usuario" className="btn btn-primary" onClick={() => { setEditUser(null); setForm(FORM_EMPTY); setShowForm(true) }}>
          + Nuevo usuario
        </button>
      </div>

      {/* Estadísticas rápidas */}
      <div className="grid grid-4" style={{ marginBottom: '1.5rem' }}>
        {[
          { label: 'Total usuarios', value: usuarios.length, color: 'var(--primary)' },
          { label: 'Activos', value: usuarios.filter(u => u.activo).length, color: 'var(--success)' },
          { label: 'Inactivos', value: usuarios.filter(u => !u.activo).length, color: 'var(--text-muted)' },
          { label: 'Administradores', value: usuarios.filter(u => u.rol === 'admin').length, color: 'var(--danger)' },
        ].map(({ label, value, color }) => (
          <div key={label} className="card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 28, fontWeight: 800, color }}>{value}</div>
            <div className="text-muted text-sm">{label}</div>
          </div>
        ))}
      </div>

      {/* Tabla de usuarios */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">Usuarios registrados</div>
        </div>
        {isLoading ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <span className="animate-spin">⟳</span> Cargando usuarios...
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Correo electrónico</th>
                  <th>Rol</th>
                  <th>Estado</th>
                  <th>Último acceso</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {usuarios.length === 0 ? (
                  <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
                    No hay usuarios registrados
                  </td></tr>
                ) : usuarios.map(u => (
                  <tr key={u.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                          width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                          background: `${ROL_COLORS[u.rol]}33`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 12, fontWeight: 700, color: ROL_COLORS[u.rol],
                        }}>
                          {u.nombre_completo?.slice(0, 2).toUpperCase() || u.email.slice(0, 2).toUpperCase()}
                        </div>
                        <span style={{ fontWeight: 500 }}>{u.nombre_completo || '—'}</span>
                        {u.email === currentUser?.email && <span className="badge badge-primary" style={{ fontSize: 10 }}>Tú</span>}
                      </div>
                    </td>
                    <td className="text-muted font-mono" style={{ fontSize: 12 }}>{u.email}</td>
                    <td><RolBadge rol={u.rol} /></td>
                    <td>
                      <span className={`badge ${u.activo ? 'badge-success' : 'badge-muted'}`}>
                        {u.activo ? '● Activo' : '○ Inactivo'}
                      </span>
                    </td>
                    <td className="text-muted text-sm">
                      {u.ultimo_acceso ? new Date(u.ultimo_acceso).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Nunca'}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => openEdit(u)} title="Editar">✏️</button>
                        {u.activo && u.email !== currentUser?.email && (
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() => { if (window.confirm(`¿Desactivar a ${u.email}?`)) desactivarMutation.mutate(u.id) }}
                            title="Desactivar"
                          >⊗</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal formulario */}
      {showForm && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 200, padding: '1rem',
        }} onClick={resetForm}>
          <div className="card animate-fade" style={{ width: '100%', maxWidth: 480 }} onClick={e => e.stopPropagation()}>
            <div className="card-header">
              <div className="card-title">{editUser ? `Editar: ${editUser.email}` : 'Nuevo usuario'}</div>
              <button className="btn btn-ghost btn-sm" onClick={resetForm}>✕</button>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {!editUser && (
                <div className="form-group">
                  <label className="form-label required">Correo electrónico</label>
                  <input id="form-email" type="email" className="form-control" value={form.email}
                    onChange={e => setForm({ ...form, email: e.target.value })} required />
                </div>
              )}
              <div className="form-group">
                <label className="form-label">Nombre completo</label>
                <input id="form-nombre" type="text" className="form-control" value={form.nombre_completo}
                  onChange={e => setForm({ ...form, nombre_completo: e.target.value })} placeholder="Ej. Carlos Oviedo" />
              </div>
              <div className="form-group">
                <label className="form-label required">Rol</label>
                <select id="form-rol" className="form-control" value={form.rol} onChange={e => setForm({ ...form, rol: e.target.value })}>
                  {ROLES.map(r => <option key={r} value={r}>{ROL_LABELS[r]}</option>)}
                </select>
                <span className="form-hint">
                  {form.rol === 'admin' && '⚠️ Acceso total al sistema'}
                  {form.rol === 'operador' && '📋 Puede editar catastro y ejecutar simulaciones'}
                  {form.rol === 'tecnico' && '🔧 Puede consultar y actualizar estados'}
                  {form.rol === 'visualizador' && '👁 Solo lectura'}
                </span>
              </div>
              <div className="form-group">
                <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span className={editUser ? '' : 'required'}>Contraseña</span>
                  {editUser && <span className="text-muted text-xs">Dejar en blanco para no cambiar</span>}
                </label>
                <input id="form-password" type="password" className="form-control" value={form.password}
                  onChange={e => setForm({ ...form, password: e.target.value })}
                  required={!editUser} minLength={8} placeholder={editUser ? '••••••••' : 'Mínimo 8 caracteres'} />
              </div>

              {formError && <div className="alert alert-danger">{formError}</div>}

              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-ghost" onClick={resetForm}>Cancelar</button>
                <button id="form-submit" type="submit" className="btn btn-primary" disabled={isPending}>
                  {isPending ? '⟳ Guardando...' : editUser ? '💾 Actualizar' : '+ Crear usuario'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Tabla de permisos por rol */}
      <div className="card" style={{ marginTop: '1.5rem' }}>
        <div className="card-title" style={{ marginBottom: 14 }}>🔑 Permisos por rol</div>
        <div className="table-wrapper">
          <table>
            <thead><tr>
              <th>Módulo</th>
              <th style={{ textAlign: 'center' }}>Administrador</th>
              <th style={{ textAlign: 'center' }}>Operador</th>
              <th style={{ textAlign: 'center' }}>Técnico</th>
              <th style={{ textAlign: 'center' }}>Visualizador</th>
            </tr></thead>
            <tbody>
              {[
                ['🗺️ Visor GIS', '✅ Editar', '✅ Editar', '👁 Ver', '👁 Ver'],
                ['📋 Catastro (CRUD)', '✅ Completo', '✅ Completo', '✏️ Solo estado', '👁 Ver'],
                ['💧 Simulación hidráulica', '✅ Ejecutar', '✅ Ejecutar', '❌', '👁 Resultados'],
                ['📊 Dashboard', '✅', '✅', '✅', '✅'],
                ['📄 Exportar reportes', '✅', '✅', '👁 Ver', '📥 Descargar'],
                ['👥 Admin usuarios', '✅', '❌', '❌', '❌'],
              ].map(([mod, ...vals]) => (
                <tr key={mod}>
                  <td style={{ fontWeight: 500 }}>{mod}</td>
                  {vals.map((v, i) => (
                    <td key={i} style={{ textAlign: 'center', fontSize: 12.5, color: v.startsWith('✅') ? 'var(--success)' : v === '❌' ? 'var(--danger)' : 'var(--text-secondary)' }}>{v}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
