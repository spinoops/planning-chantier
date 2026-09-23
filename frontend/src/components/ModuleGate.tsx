import { Navigate, Outlet } from 'react-router-dom'
import { useSettings } from '@/hooks/useSettings'
import Spinner from '@/components/ui/Spinner'

/** Réserve les routes enfants à un module activé (config/modules.php) ; redirige sinon. */
export default function ModuleGate({ module }: { module: string }) {
  const { data, isLoading } = useSettings()

  if (isLoading) return <Spinner block />
  if (!data?.modules?.[module]) return <Navigate to="/dashboard" replace />

  return <Outlet />
}
