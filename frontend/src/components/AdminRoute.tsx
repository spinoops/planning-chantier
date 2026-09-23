import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/auth/AuthContext'

/** Réserve les routes enfants aux administrateurs (redirige sinon). */
export default function AdminRoute() {
  const { isAdmin } = useAuth()

  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />
  }

  return <Outlet />
}
