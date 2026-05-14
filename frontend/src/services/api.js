import axios from 'axios'
import { useAuthStore } from '../store/authStore'

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || '/api' })

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
export const redApi = {
  tuberias:  { list: (p) => api.get('/tuberias', { params: p }),  get: (id) => api.get(`/tuberias/${id}`) },
  nodos:     { list: (p) => api.get('/nodos', { params: p }),     get: (id) => api.get(`/nodos/${id}`) },
  valvulas:  { list: (p) => api.get('/valvulas', { params: p }),  get: (id) => api.get(`/valvulas/${id}`) },
  tanques:   { list: (p) => api.get('/tanques', { params: p }),   get: (id) => api.get(`/tanques/${id}`) },
  fuentes:   { list: (p) => api.get('/fuentes', { params: p }),   get: (id) => api.get(`/fuentes/${id}`) },
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
