import { useMemo, useState } from 'react'
import type { DragEvent } from 'react'
import { formatWeekdayShort, isSameDay, isWeekend, monthGrid, toKey, weekDays } from '@/lib/dates'
import type { Affectation } from '@/types'
import AffectationCard from '@/components/planning/AffectationCard'
import { groupByDay } from '@/lib/planning'

interface MonthViewProps {
  cursor: Date
  affectations: Affectation[]
  conflicts: Set<string>
  canEdit: boolean
  /** Clic sur un jour (ou « +N ») : ouvre la vue détaillée de ce jour. */
  onSelectDay: (key: string) => void
  /** Clic sur une case vide : créer une affectation ce jour (planificateurs). */
  onCreateAt: (key: string) => void
  onSelectAffectation: (a: Affectation) => void
  onMoveAffectation: (id: number, key: string) => void
}

const MAX_CHIPS = 3

/** Grille mensuelle (lundi → dimanche) avec pastilles par chantier. */
export default function MonthView({
  cursor,
  affectations,
  conflicts,
  canEdit,
  onSelectDay,
  onCreateAt,
  onSelectAffectation,
  onMoveAffectation,
}: MonthViewProps) {
  const today = new Date()
  const weeks = useMemo(() => monthGrid(cursor), [cursor])
  const byDay = useMemo(() => groupByDay(affectations), [affectations])
  const [dragId, setDragId] = useState<number | null>(null)
  const [overKey, setOverKey] = useState<string | null>(null)

  function onDragStart(e: DragEvent<HTMLElement>, id: number) {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', String(id))
    setDragId(id)
  }

  function onDrop(e: DragEvent<HTMLDivElement>, key: string) {
    e.preventDefault()
    const id = Number(e.dataTransfer.getData('text/plain')) || dragId
    setOverKey(null)
    setDragId(null)
    if (id) onMoveAffectation(id, key)
  }

  return (
    <div className="overflow-hidden rounded-card border border-gray-200 bg-white shadow-sm">
      <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50/70 text-center text-[11px] font-semibold uppercase tracking-wide text-gray-500">
        {weekDays(cursor).map((d) => (
          <div key={d.getDay()} className="py-2">
            {formatWeekdayShort(d)}
          </div>
        ))}
      </div>

      {weeks.map((week, wi) => (
        <div key={wi} className="grid grid-cols-7 border-b border-gray-100 last:border-0">
          {week.map((day) => {
            const key = toKey(day)
            const items = byDay.get(key) ?? []
            const inMonth = day.getMonth() === cursor.getMonth()
            const isToday = isSameDay(day, today)
            const extra = items.length - MAX_CHIPS
            const dropTarget = canEdit && overKey === key && dragId !== null

            return (
              <div
                key={key}
                role="gridcell"
                className={`day-cell group relative flex min-h-24 flex-col border-r border-gray-100 p-1 last:border-r-0 sm:min-h-32 sm:p-1.5 ${
                  !inMonth ? 'bg-gray-50/60' : isWeekend(day) ? 'bg-gray-50/30' : ''
                } ${dropTarget ? 'is-drop-target' : ''}`}
                onDragOver={canEdit ? (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; if (overKey !== key) setOverKey(key) } : undefined}
                onDragLeave={canEdit ? () => setOverKey((k) => (k === key ? null : k)) : undefined}
                onDrop={canEdit ? (e) => onDrop(e, key) : undefined}
                onDoubleClick={canEdit ? () => onCreateAt(key) : undefined}
              >
                <div className="mb-1 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => onSelectDay(key)}
                    className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold transition hover:bg-gray-200 ${
                      isToday ? 'bg-primary text-white hover:bg-primary-hover' : inMonth ? 'text-gray-800' : 'text-gray-400'
                    }`}
                    aria-label={`Voir le ${key}`}
                  >
                    {day.getDate()}
                  </button>
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => onCreateAt(key)}
                      aria-label="Ajouter une affectation"
                      className="hidden h-5 w-5 items-center justify-center rounded text-gray-400 opacity-0 transition hover:bg-gray-200 hover:text-gray-700 group-hover:opacity-100 sm:flex"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M12 5v14M5 12h14" strokeLinecap="round" />
                      </svg>
                    </button>
                  )}
                </div>

                {/* Écrans larges : pastilles nommées. */}
                <div className="hidden flex-1 flex-col gap-1 sm:flex">
                  {items.slice(0, MAX_CHIPS).map((a) => (
                    <AffectationCard
                      key={a.id}
                      affectation={a}
                      variant="compact"
                      conflicts={conflicts}
                      onClick={() => onSelectAffectation(a)}
                      draggable={canEdit}
                      dragging={dragId === a.id}
                      onDragStart={(e) => onDragStart(e, a.id)}
                      onDragEnd={() => { setDragId(null); setOverKey(null) }}
                    />
                  ))}
                  {extra > 0 && (
                    <button
                      type="button"
                      onClick={() => onSelectDay(key)}
                      className="rounded px-1.5 py-0.5 text-left text-[11px] font-medium text-gray-500 transition hover:bg-gray-100 hover:text-gray-800"
                    >
                      + {extra} autre{extra > 1 ? 's' : ''}
                    </button>
                  )}
                </div>

                {/* Petits écrans : points colorés, clic = jour. */}
                {items.length > 0 && (
                  <button
                    type="button"
                    onClick={() => onSelectDay(key)}
                    aria-label={`${items.length} affectation(s)`}
                    className="flex flex-1 flex-wrap content-start gap-1 px-0.5 sm:hidden"
                  >
                    {items.slice(0, 6).map((a) => (
                      <span key={a.id} className="h-2 w-2 rounded-full" style={{ backgroundColor: a.chantier.color }} />
                    ))}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}
