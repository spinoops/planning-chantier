import type { ReactNode } from 'react'
import Button from '@/components/ui/Button'

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

/** Barre de navigation du calendrier : aujourd'hui, ‹ ›, titre, vue, actions. */
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
    <div className="mb-4 space-y-3">
      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        <Button variant="secondary" size="sm" onClick={onToday}>
          Aujourd'hui
        </Button>
        <div className="inline-flex overflow-hidden rounded-lg border border-gray-300 bg-white">
          <button
            type="button"
            onClick={onPrev}
            aria-label="Période précédente"
            className="flex h-8 w-9 items-center justify-center text-gray-600 transition hover:bg-gray-50"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="m15 6-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <button
            type="button"
            onClick={onNext}
            aria-label="Période suivante"
            className="flex h-8 w-9 items-center justify-center border-l border-gray-200 text-gray-600 transition hover:bg-gray-50"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="m9 6 6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        <div className="flex min-w-0 items-baseline gap-2">
          <h2 className="truncate text-lg font-semibold capitalize text-gray-900 sm:text-xl">{title}</h2>
          {subtitle && <span className="hidden text-sm text-gray-500 sm:inline">{subtitle}</span>}
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
                className="rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm md:hidden"
              >
                {VIEWS.map((v) => (
                  <option key={v.value} value={v.value}>
                    {v.label}
                  </option>
                ))}
              </select>
              <div className="hidden rounded-lg bg-gray-100 p-0.5 md:inline-flex" role="tablist" aria-label="Vue du calendrier">
                {VIEWS.map((v) => (
                  <button
                    key={v.value}
                    type="button"
                    role="tab"
                    aria-selected={view === v.value}
                    onClick={() => onViewChange(v.value)}
                    className={`rounded-md px-3 py-1 text-sm font-medium transition ${
                      view === v.value ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
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
