import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/auth/AuthContext'

/**
 * Réserve les routes enfants aux utilisateurs ayant l'un des rôles donnés
 * (les admins passent toujours). Exemple : <Route element={<RoleRoute roles={['manager']} />}>.
 */
export default function RoleRoute({ roles, redirectTo = '/dashboard' }: { roles: string[]; redirectTo?: string }) {
  const { isAdmin, hasRole } = useAuth()

  if (!isAdmin && !hasRole(...roles)) {
    return <Navigate to={redirectTo} replace />
  }

  return <Outlet />
}
