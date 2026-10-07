import type { ReactNode } from 'react'

export type CalendarView = 'month' | 'week' | 'day' | 'staff'

const VIEWS: { value: CalendarView; label: string }[] = [
  { value: 'month', label: 'Mois' },
  { value: 'week', label: 'Semaine' },
  { value: 'day', label: 'Jour' },
  { value: 'staff', label: 'Par employé' },
]

interface CalendarToolbarProps {
  title: string
  /** Sous-titre (ex. numéro de semaine). */
  subtitle?: string
  view?: CalendarView
  onViewChange?: (view: CalendarView) => void
  onPrev: () => void
  onNext: () => void
  onToday: () => void
  /** Filtres (sélecteurs) affichés sous la barre. */
  filters?: ReactNode
  /** Actions à droite (nouvelle affectation, copie de semaine…). */
  actions?: ReactNode
  busy?: boolean
}

const PILL = 'glass-pill inline-flex items-center justify-center rounded-full text-gray-800 active:scale-95'

/** Barre de navigation du calendrier (façon Apple Calendrier) : ‹ aujourd'hui ›, titre, contrôle segmenté des vues, actions. */
export default function CalendarToolbar({
  title,
  subtitle,
  view,
  onViewChange,
  onPrev,
  onNext,
  onToday,
  filters,
  actions,
  busy = false,
}: CalendarToolbarProps) {
  return (
    <div className="mb-3 space-y-2.5">
      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        <div className="flex items-center gap-1">
          <button type="button" onClick={onPrev} aria-label="Période précédente" className={`${PILL} h-8 w-8`}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6">
              <path d="m15 6-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <button type="button" onClick={onToday} className={`${PILL} h-8 px-3.5 text-[13px] font-medium`}>
            Aujourd'hui
          </button>
          <button type="button" onClick={onNext} aria-label="Période suivante" className={`${PILL} h-8 w-8`}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6">
              <path d="m9 6 6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        <div className="flex min-w-0 items-baseline gap-2">
          <h2 className="truncate text-[20px] font-bold capitalize tracking-tight text-gray-900 sm:text-[22px]">{title}</h2>
          {subtitle && <span className="hidden text-[13px] text-gray-500 sm:inline">{subtitle}</span>}
          {busy && <span className="h-3 w-3 animate-spin rounded-full border-2 border-gray-300 border-t-primary" aria-label="Chargement" />}
        </div>

        <div className="ml-auto flex items-center gap-2">
          {view && onViewChange && (
            <>
              {/* Petits écrans : un sélecteur compact. */}
              <select
                value={view}
                onChange={(e) => onViewChange(e.target.value as CalendarView)}
                aria-label="Vue du calendrier"
                className="glass-pill rounded-full px-3 py-1.5 text-sm md:hidden"
              >
                {VIEWS.map((v) => (
                  <option key={v.value} value={v.value}>
                    {v.label}
                  </option>
                ))}
              </select>
              {/* Contrôle segmenté (macOS). */}
              <div className="hidden rounded-full bg-white/35 p-1 shadow-[inset_0_1px_2px_rgb(15_40_90/0.08),inset_0_0_0_1px_rgb(255_255_255/0.4)] md:inline-flex" role="tablist" aria-label="Vue du calendrier">
                {VIEWS.map((v) => (
                  <button
                    key={v.value}
                    type="button"
                    role="tab"
                    aria-selected={view === v.value}
                    onClick={() => onViewChange(v.value)}
                    className={`whitespace-nowrap rounded-full px-3.5 py-1 text-[13px] font-medium transition ${
                      view === v.value
                        ? 'bg-white text-gray-900 shadow-[0_1px_3px_rgb(15_40_90/0.15),inset_0_1px_0_rgb(255_255_255)]'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    {v.label}
                  </button>
                ))}
              </div>
            </>
          )}
          {actions}
        </div>
      </div>
      {filters && <div className="flex flex-wrap items-center gap-2">{filters}</div>}
    </div>
  )
}
