import { Navigate } from 'react-router-dom'
import { useAuth } from '@/auth/AuthContext'
import { homePath } from '@/lib/navigation'

/** Page d'accueil selon le rôle : planning (chef / admin) ou « Mon planning » (ouvrier). */
export default function HomeRedirect() {
  const { user } = useAuth()
  return <Navigate to={homePath(user)} replace />
}
