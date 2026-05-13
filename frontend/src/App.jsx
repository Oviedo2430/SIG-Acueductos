import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/authStore'
import Layout from './components/Layout/Layout'
import LoginPage from './pages/LoginPage'
import MapPage from './pages/MapPage'
import CatastroPage from './pages/CatastroPage'
import GuiaShapefilePage from './pages/GuiaShapefilePage'
import DashboardPage from './pages/DashboardPage'

function ProtectedRoute({ children }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  return isAuthenticated ? children : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/mapa" replace />} />
        <Route path="mapa"      element={<MapPage />} />
        <Route path="catastro"  element={<CatastroPage />} />
        <Route path="guia-shapefile" element={<GuiaShapefilePage />} />
        <Route path="dashboard" element={<DashboardPage />} />
      </Route>
    </Routes>
  )
}
