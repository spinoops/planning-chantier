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
  /** Ancre (liens `#…`). */
  id?: string
}

/** Panneau en verre liquide (translucide, reflet en haut, sans bordure), conteneur standard des pages. */
export default function Card({ children, className = '', title, description, action, flush = false, id }: CardProps) {
  return (
    <section id={id} className={`glass-panel overflow-hidden rounded-card ${className}`}>
      {(title || action) && (
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-black/[0.06] px-5 py-4">
          <div>
            {title && <h3 className="text-[15px] font-semibold tracking-tight text-gray-900">{title}</h3>}
            {description && <p className="mt-0.5 text-[13px] text-gray-500">{description}</p>}
          </div>
          {action}
        </header>
      )}
      <div className={flush ? '' : 'p-5'}>{children}</div>
    </section>
  )
}
