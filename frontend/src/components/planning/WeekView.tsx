import { useMemo, useState } from 'react'
import type { DragEvent } from 'react'
import { formatWeekdayShort, isSameDay, isWeekend, toKey, weekDays } from '@/lib/dates'
import type { Affectation } from '@/types'
import AffectationCard from '@/components/planning/AffectationCard'
import { groupByDay } from '@/lib/planning'

interface WeekViewProps {
  cursor: Date
  affectations: Affectation[]
  conflicts: Set<string>
  canEdit: boolean
  onCreateAt: (key: string) => void
  onSelectAffectation: (a: Affectation) => void
  onMoveAffectation: (id: number, key: string) => void
}

/** Sept colonnes (lundi → dimanche) avec les cartes d'affectation du jour. */
export default function WeekView({ cursor, affectations, conflicts, canEdit, onCreateAt, onSelectAffectation, onMoveAffectation }: WeekViewProps) {
  const today = new Date()
  const days = useMemo(() => weekDays(cursor), [cursor])
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
    <div className="overflow-x-auto rounded-card border border-gray-200 bg-white shadow-sm">
      <div className="grid min-w-[980px] grid-cols-7">
        {days.map((day) => {
          const key = toKey(day)
          const items = byDay.get(key) ?? []
          const isToday = isSameDay(day, today)
          const dropTarget = canEdit && overKey === key && dragId !== null
          const people = new Set(items.flatMap((a) => a.workers.map((w) => w.id))).size

          return (
            <div
              key={key}
              className={`day-cell flex min-h-[420px] flex-col border-r border-gray-100 last:border-r-0 ${isWeekend(day) ? 'bg-gray-50/40' : ''} ${
                dropTarget ? 'is-drop-target' : ''
              }`}
              onDragOver={canEdit ? (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; if (overKey !== key) setOverKey(key) } : undefined}
              onDragLeave={canEdit ? () => setOverKey((k) => (k === key ? null : k)) : undefined}
              onDrop={canEdit ? (e) => onDrop(e, key) : undefined}
            >
              <div className={`sticky top-0 z-10 border-b border-gray-100 px-2 py-2 ${isToday ? 'bg-primary-soft' : 'bg-white/95'}`}>
                <div className="flex items-center gap-2">
                  <span
                    className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
                      isToday ? 'bg-primary text-white' : 'text-gray-900'
                    }`}
                  >
                    {day.getDate()}
                  </span>
                  <div className="min-w-0">
                    <p className={`text-xs font-semibold uppercase tracking-wide ${isToday ? 'text-primary' : 'text-gray-500'}`}>{formatWeekdayShort(day)}</p>
                    <p className="text-[11px] text-gray-500">
                      {items.length === 0 ? '—' : `${items.length} chantier${items.length > 1 ? 's' : ''} · ${people} pers.`}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex flex-1 flex-col gap-2 p-2">
                {items.map((a) => (
                  <AffectationCard
                    key={a.id}
                    affectation={a}
                    variant="card"
                    conflicts={conflicts}
                    onClick={() => onSelectAffectation(a)}
                    draggable={canEdit}
                    dragging={dragId === a.id}
                    onDragStart={(e) => onDragStart(e, a.id)}
                    onDragEnd={() => { setDragId(null); setOverKey(null) }}
                  />
                ))}
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => onCreateAt(key)}
                    className="mt-auto flex items-center justify-center gap-1 rounded-lg border border-dashed border-gray-300 py-2 text-xs font-medium text-gray-400 transition hover:border-primary hover:bg-primary-soft hover:text-primary"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M12 5v14M5 12h14" strokeLinecap="round" />
                    </svg>
                    Ajouter
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
