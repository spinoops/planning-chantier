import type { ReactNode } from 'react'

interface CardProps {
  children: ReactNode
  className?: string
  /** En-tête optionnel (titre + description + action à droite). */
  title?: ReactNode
  description?: ReactNode
  action?: ReactNode
  /** Sans padding interne (tableaux pleine largeur). */
  flush?: boolean
}

/** Bloc blanc arrondi, conteneur standard des pages. */
export default function Card({ children, className = '', title, description, action, flush = false }: CardProps) {
  return (
    <section className={`overflow-hidden rounded-card border border-gray-200 bg-white shadow-sm ${className}`}>
      {(title || action) && (
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-gray-100 px-5 py-4">
          <div>
            {title && <h3 className="text-base font-semibold text-gray-900">{title}</h3>}
            {description && <p className="mt-0.5 text-sm text-gray-500">{description}</p>}
          </div>
          {action}
        </header>
      )}
      <div className={flush ? '' : 'p-5'}>{children}</div>
    </section>
  )
}
