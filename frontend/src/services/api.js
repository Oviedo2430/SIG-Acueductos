import axios from 'axios'
import { useAuthStore } from '../store/authStore'

let baseUrl = import.meta.env.VITE_API_URL || '/api'
// Hack para limpiar un bug raro de EasyPanel donde inyecta "VITE_API_URL=" dentro del valor
if (baseUrl.startsWith('VITE_API_URL=')) {
  baseUrl = baseUrl.replace('VITE_API_URL=', '')
}
const api = axios.create({ baseURL: baseUrl })

// Adjuntar token JWT a cada petición
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Si el token expira, limpiar sesión
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) useAuthStore.getState().logout()
    return Promise.reject(err)
  }
)

export default api

// ── Endpoints de red ──────────────────────────────────────
const crud = (path) => ({
  list:   (p) => api.get(path, { params: p }),
  get:    (id) => api.get(`${path}/${id}`),
  create: (data) => api.post(path, data),
  update: (id, data) => api.put(`${path}/${id}`, data),
  delete: (id) => api.delete(`${path}/${id}`),
})

export const redApi = {
  tuberias: crud('/tuberias'),
  nodos:    crud('/nodos'),
  valvulas: crud('/valvulas'),
  tanques:  crud('/tanques'),
  fuentes:  crud('/fuentes'),
}

// ── Importación de shapefiles ─────────────────────────────
export const importApi = {
  uploadShapefile: (tipo, formData) =>
    api.post(`/importacion/shapefile/${tipo}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  validarShapefile: (tipo, formData) =>
    api.post(`/importacion/validar/${tipo}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
}

// ── Autenticación ─────────────────────────────────────────
export const authApi = {
  login: (email, password) => api.post('/auth/login', { email, password }),
  me:    () => api.get('/auth/me'),
}
