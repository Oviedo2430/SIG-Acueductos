import { useState } from 'react'

const FORMS = {
  tuberias: [
    { name: 'codigo', label: 'Código', type: 'text', required: true },
    { name: 'diametro_mm', label: 'Diámetro (mm)', type: 'number', required: true },
    { name: 'material', label: 'Material', type: 'select', options: ['PVC', 'AC', 'HF', 'PE', 'Asbesto'] },
    { name: 'estado', label: 'Estado', type: 'select', options: ['Bueno', 'Regular', 'Malo', 'Critico'] },
  ],
  nodos: [
    { name: 'codigo', label: 'Código', type: 'text', required: true },
    { name: 'tipo', label: 'Tipo', type: 'select', options: ['Union', 'Tee', 'Codo', 'Conexion', 'Hidrante'] },
    { name: 'cota_msnm', label: 'Cota (msnm)', type: 'number', required: true },
  ],
  valvulas: [
    { name: 'codigo', label: 'Código', type: 'text', required: true },
    { name: 'tipo', label: 'Tipo', type: 'select', options: ['PRV', 'TCV', 'GPV', 'FCV', 'PBV', 'CV'] },
    { name: 'estado', label: 'Estado', type: 'select', options: ['Abierta', 'Cerrada', 'Parcial'] },
    { name: 'diametro_mm', label: 'Diámetro (mm)', type: 'number' },
  ],
  tanques: [
    { name: 'codigo', label: 'Código', type: 'text', required: true },
    { name: 'nombre', label: 'Nombre', type: 'text' },
    { name: 'capacidad_m3', label: 'Capacidad (m³)', type: 'number' },
  ],
}

export default function ElementForm({ layerType, onSubmit, onCancel, isSaving }) {
  const fields = FORMS[layerType] || []
  
  // Inicializar estado con valores por defecto
  const [formData, setFormData] = useState(() => {
    const initial = {}
    fields.forEach(f => {
      initial[f.name] = f.type === 'select' ? f.options[0] : ''
    })
    return initial
  })

  const handleChange = (e) => {
    const { name, value, type } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? (value ? parseFloat(value) : null) : value
    }))
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    onSubmit(formData)
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <div style={{ fontWeight: 600, color: 'var(--fg)', marginBottom: 4, textTransform: 'capitalize' }}>
        Registrar {layerType.slice(0, -1)}
      </div>

      {fields.map(field => (
        <div key={field.name} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 12, color: 'var(--text-muted)' }}>{field.label}</label>
          
          {field.type === 'select' ? (
            <select
              name={field.name}
              value={formData[field.name]}
              onChange={handleChange}
              className="form-input"
              style={{ fontSize: 13, padding: '4px 8px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--fg)' }}
            >
              {field.options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
            </select>
          ) : (
            <input
              type={field.type === 'number' ? 'number' : 'text'}
              step={field.type === 'number' ? 'any' : undefined}
              name={field.name}
              value={formData[field.name] ?? ''}
              onChange={handleChange}
              required={field.required}
              className="form-input"
              style={{ fontSize: 13, padding: '4px 8px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--fg)' }}
              autoComplete="off"
            />
          )}
        </div>
      ))}

      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <button type="button" onClick={onCancel} className="btn btn-ghost btn-sm" style={{ flex: 1 }} disabled={isSaving}>
          Cancelar
        </button>
        <button type="submit" className="btn btn-primary btn-sm" style={{ flex: 1 }} disabled={isSaving}>
          {isSaving ? 'Guardando...' : 'Guardar'}
        </button>
      </div>
    </form>
  )
}
