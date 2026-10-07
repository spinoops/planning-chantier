import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'

interface PageHeaderProps {
  title: string
  subtitle?: ReactNode
  /** Bouton(s) d'action à droite. */
  action?: ReactNode
  /** Bouton retour : true = historique, ou une route cible. */
  back?: boolean | string
}

/** En-tête standard des pages : grand titre (façon iOS), sous-titre, action, retour optionnel. */
export default function PageHeader({ title, subtitle, action, back }: PageHeaderProps) {
  const navigate = useNavigate()

  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3">
        {back && (
          <button
            type="button"
            onClick={() => (typeof back === 'string' ? navigate(back) : navigate(-1))}
            aria-label="Retour"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-900/[0.05] text-gray-700 transition hover:bg-gray-900/[0.09] active:scale-95"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="m15 6-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        )}
        <div className="min-w-0">
          <h2 className="truncate text-[28px] font-bold tracking-tight text-gray-900">{title}</h2>
          {subtitle && <p className="mt-0.5 text-[15px] text-gray-500">{subtitle}</p>}
        </div>
      </div>
      {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
    </div>
  )
}
