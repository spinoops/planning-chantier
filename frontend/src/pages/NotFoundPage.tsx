import { Link } from 'react-router-dom'
import Button from '@/components/ui/Button'

/** Page 404 de la SPA. */
export default function NotFoundPage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <p className="text-6xl font-bold text-gray-200">404</p>
      <h2 className="mt-2 text-xl font-semibold text-gray-900">Page introuvable</h2>
      <p className="mt-1 text-sm text-gray-500">L'adresse demandée n'existe pas ou a été déplacée.</p>
      <Link to="/dashboard" className="mt-6">
        <Button variant="secondary">Retour au tableau de bord</Button>
      </Link>
    </div>
  )
}
