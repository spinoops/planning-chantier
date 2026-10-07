import type { ReactNode } from 'react'

export type CalendarView = 'month' | 'week' | 'day' | 'list' | 'team' | 'site'

const VIEWS: { value: CalendarView; label: string; mobile?: boolean }[] = [
  { value: 'month', label: 'Mois' },
  { value: 'week', label: 'Semaine' },
  { value: 'day', label: 'Jour', mobile: true },
  { value: 'list', label: 'Liste', mobile: true },
  { value: 'team', label: 'Par équipe' },
  { value: 'site', label: 'Par chantier' },
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

const PILL = 'inline-flex items-center justify-center rounded-full bg-gray-900/[0.05] text-gray-800 transition hover:bg-gray-900/[0.09] active:scale-95'

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
                className="rounded-[10px] border border-black/[0.08] bg-gray-100/70 px-2 py-1.5 text-sm md:hidden"
              >
                {VIEWS.map((v) => (
                  <option key={v.value} value={v.value}>
                    {v.label}
                  </option>
                ))}
              </select>
              {/* Contrôle segmenté (macOS). */}
              <div className="hidden rounded-[9px] bg-gray-900/[0.06] p-[3px] md:inline-flex" role="tablist" aria-label="Vue du calendrier">
                {VIEWS.map((v) => (
                  <button
                    key={v.value}
                    type="button"
                    role="tab"
                    aria-selected={view === v.value}
                    onClick={() => onViewChange(v.value)}
                    className={`whitespace-nowrap rounded-[7px] px-3 py-1 text-[13px] font-medium transition ${
                      view === v.value
                        ? 'bg-white text-gray-900 shadow-[0_1px_3px_rgb(0_0_0/0.12),0_0_0_0.5px_rgb(0_0_0/0.04)]'
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
