import { useMemo } from 'react'
import { formatRelativeDay, isSameDay, isWeekend, toKey } from '@/lib/dates'
import type { Affectation } from '@/types'
import AffectationCard from '@/components/planning/AffectationCard'
import { groupByDay } from '@/lib/planning'

interface AgendaListProps {
  days: Date[]
  affectations: Affectation[]
  conflicts?: Set<string>
  canEdit?: boolean
  onCreateAt?: (key: string) => void
  onSelectAffectation?: (a: Affectation) => void
  /** Masquer les jours sans affectation (week-ends vides par ex.). */
  hideEmptyWeekends?: boolean
}

/** Liste jour par jour (vue mobile et « Mon planning »). */
export default function AgendaList({
  days,
  affectations,
  conflicts,
  canEdit = false,
  onCreateAt,
  onSelectAffectation,
  hideEmptyWeekends = true,
}: AgendaListProps) {
  const today = new Date()
  const byDay = useMemo(() => groupByDay(affectations), [affectations])

  return (
    <div className="space-y-3">
      {days.map((day) => {
        const key = toKey(day)
        const items = byDay.get(key) ?? []
        if (items.length === 0 && hideEmptyWeekends && isWeekend(day)) return null
        const isToday = isSameDay(day, today)

        return (
          <section key={key} className={`overflow-hidden rounded-card border bg-white shadow-sm ${isToday ? 'border-primary/40 ring-1 ring-primary/20' : 'border-gray-200'}`}>
            <header className={`flex items-center justify-between gap-3 px-4 py-2.5 ${isToday ? 'bg-primary-soft' : 'bg-gray-50/70'}`}>
              <div className="flex items-center gap-3">
                <span className={`flex h-9 w-9 items-center justify-center rounded-full text-base font-bold ${isToday ? 'bg-primary text-white' : 'bg-white text-gray-900 ring-1 ring-gray-200'}`}>
                  {day.getDate()}
                </span>
                <div>
                  <p className={`text-sm font-semibold ${isToday ? 'text-primary' : 'text-gray-900'}`}>{formatRelativeDay(day)}</p>
                  <p className="text-xs text-gray-500">{items.length === 0 ? 'Rien de prévu' : `${items.length} chantier${items.length > 1 ? 's' : ''}`}</p>
                </div>
              </div>
              {canEdit && onCreateAt && (
                <button
                  type="button"
                  onClick={() => onCreateAt(key)}
                  className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-primary transition hover:bg-white"
                >
                  + Ajouter
                </button>
              )}
            </header>
            {items.length > 0 && (
              <div className="grid gap-2 p-3 sm:grid-cols-2">
                {items.map((a) => (
                  <AffectationCard
                    key={a.id}
                    affectation={a}
                    variant="detail"
                    conflicts={conflicts}
                    onClick={onSelectAffectation ? () => onSelectAffectation(a) : undefined}
                  />
                ))}
              </div>
            )}
          </section>
        )
      })}
    </div>
  )
}
