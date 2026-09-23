import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '@/auth/AuthContext'
import { useOpenChantiers } from '@/hooks/useChantiers'
import { useCopyWeek, usePlanning, useUpdateAffectation } from '@/hooks/usePlanning'
import { useWorkers } from '@/hooks/useWorkers'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { getErrorMessage } from '@/lib/errors'
import {
  addDays,
  addMonths,
  formatMonthYear,
  formatWeekRange,
  fromKey,
  isoWeek,
  monthGrid,
  startOfWeek,
  toKey,
  todayKey,
  weekDays,
} from '@/lib/dates'
import { isPlanner } from '@/lib/navigation'
import { toast } from '@/lib/toast'
import type { Affectation } from '@/types'
import Button from '@/components/ui/Button'
import Select from '@/components/ui/Select'
import Spinner from '@/components/ui/Spinner'
import EmptyState from '@/components/ui/EmptyState'
import AffectationModal from '@/components/planning/AffectationModal'
import type { AffectationTarget } from '@/components/planning/AffectationModal'
import AgendaList from '@/components/planning/AgendaList'
import CalendarToolbar from '@/components/planning/CalendarToolbar'
import type { CalendarView } from '@/components/planning/CalendarToolbar'
import MonthView from '@/components/planning/MonthView'
import WeekView from '@/components/planning/WeekView'

const VIEW_KEY = 'planning_view'

function defaultView(): CalendarView {
  try {
    const stored = localStorage.getItem(VIEW_KEY) as CalendarView | null
    if (stored === 'month' || stored === 'week' || stored === 'agenda') return stored
  } catch {
    // stockage indisponible
  }
  return typeof window !== 'undefined' && window.innerWidth < 768 ? 'agenda' : 'week'
}

/**
 * Calendrier du planning (planificateurs) : vue mois / semaine / liste,
 * filtres par chantier et par ouvrier, création par clic, déplacement par
 * glisser-déposer, copie de la semaine précédente.
 * L'état (vue, date, filtres) vit dans l'URL : ?view=week&d=2026-09-21&chantier=3.
 */
export default function PlanningPage() {
  const { user } = useAuth()
  const canEdit = isPlanner(user)
  const [searchParams, setSearchParams] = useSearchParams()
  const confirm = useConfirm()

  const view = (searchParams.get('view') as CalendarView | null) ?? defaultView()
  const cursorKey = searchParams.get('d') ?? todayKey()
  const cursor = useMemo(() => fromKey(cursorKey), [cursorKey])
  const chantierFilter = Number(searchParams.get('chantier')) || 0
  const workerFilter = Number(searchParams.get('ouvrier')) || 0

  const setParams = useCallback(
    (patch: Record<string, string | number | null>) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          for (const [k, v] of Object.entries(patch)) {
            if (v === null || v === '' || v === 0) next.delete(k)
            else next.set(k, String(v))
          }
          return next
        },
        { replace: true },
      )
    },
    [setSearchParams],
  )

  useEffect(() => {
    try {
      localStorage.setItem(VIEW_KEY, view)
    } catch {
      // ignore
    }
  }, [view])

  // Période chargée selon la vue.
  const range = useMemo(() => {
    if (view === 'month') {
      const grid = monthGrid(cursor)
      return { from: toKey(grid[0][0]), to: toKey(grid[grid.length - 1][6]) }
    }
    const days = weekDays(cursor)
    return { from: toKey(days[0]), to: toKey(days[6]) }
  }, [view, cursor])

  const { data: affectations = [], isLoading, isFetching } = usePlanning({
    ...range,
    chantier_id: chantierFilter || undefined,
    worker_id: workerFilter || undefined,
  })
  // Pour signaler les doublons du jour on a besoin de tout le monde, même filtré.
  const { data: allAffectations = [] } = usePlanning(range, Boolean(chantierFilter || workerFilter))
  const { data: chantiers = [] } = useOpenChantiers()
  const { data: workers = [] } = useWorkers(canEdit)
  const updateAffectation = useUpdateAffectation()
  const copyWeek = useCopyWeek()

  const [target, setTarget] = useState<AffectationTarget | null>(null)

  const conflicts = useMemo(() => {
    const seen = new Map<string, number>()
    const set = new Set<string>()
    const source = chantierFilter || workerFilter ? allAffectations : affectations
    for (const a of source) {
      for (const w of a.workers) {
        const key = `${a.date}:${w.id}`
        seen.set(key, (seen.get(key) ?? 0) + 1)
        if ((seen.get(key) ?? 0) > 1) set.add(key)
      }
    }
    return set
  }, [affectations, allAffectations, chantierFilter, workerFilter])

  function navigate(direction: -1 | 0 | 1) {
    if (direction === 0) return setParams({ d: todayKey() })
    const next = view === 'month' ? addMonths(cursor, direction) : addDays(cursor, 7 * direction)
    setParams({ d: toKey(next) })
  }

  function openDay(key: string) {
    setParams({ d: key, view: 'agenda' })
  }

  function moveAffectation(id: number, key: string) {
    const current = affectations.find((a) => a.id === id)
    if (!current || current.date === key) return
    updateAffectation.mutate(
      { id, payload: { date: key } },
      {
        onSuccess: () => toast(`${current.chantier.name} déplacé.`, 'success'),
        onError: (err) => toast(getErrorMessage(err, 'Déplacement impossible.'), 'error'),
      },
    )
  }

  async function onCopyPreviousWeek() {
    const monday = startOfWeek(cursor)
    const from = toKey(addDays(monday, -7))
    const to = toKey(monday)
    const hasCurrent = affectations.length > 0
    const ok = await confirm({
      title: 'Copier la semaine précédente ?',
      message: hasCurrent
        ? 'Les affectations de la semaine précédente seront ajoutées à celles déjà présentes cette semaine.'
        : 'Chantiers, horaires et équipes de la semaine précédente seront recopiés sur cette semaine.',
      confirmLabel: 'Copier',
    })
    if (!ok) return
    copyWeek.mutate(
      { from, to },
      {
        onSuccess: (res) => toast(res.message, res.created > 0 ? 'success' : 'info'),
        onError: (err) => toast(getErrorMessage(err), 'error'),
      },
    )
  }

  const title = view === 'month' ? formatMonthYear(cursor) : formatWeekRange(cursor)
  const subtitle = view === 'month' ? undefined : `Semaine ${isoWeek(cursor)}`
  const weekDaysList = useMemo(() => weekDays(cursor), [cursor])

  const openCreate = (key?: string) => setTarget({ date: key ?? (range.from <= todayKey() && todayKey() <= range.to ? todayKey() : cursorKey) })
  const openEdit = (a: Affectation) => setTarget({ affectation: a })

  return (
    <div>
      <CalendarToolbar
        title={title}
        subtitle={subtitle}
        view={view}
        onViewChange={(v) => setParams({ view: v })}
        onPrev={() => navigate(-1)}
        onNext={() => navigate(1)}
        onToday={() => navigate(0)}
        busy={isFetching && !isLoading}
        filters={
          <>
            <Select value={chantierFilter || ''} onChange={(e) => setParams({ chantier: e.target.value })} className="w-auto min-w-44 py-1.5" aria-label="Filtrer par chantier">
              <option value="">Tous les chantiers</option>
              {chantiers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
            {canEdit && (
              <Select value={workerFilter || ''} onChange={(e) => setParams({ ouvrier: e.target.value })} className="w-auto min-w-44 py-1.5" aria-label="Filtrer par ouvrier">
                <option value="">Toute l'équipe</option>
                {workers.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </Select>
            )}
            {(chantierFilter || workerFilter) !== 0 && (
              <button type="button" onClick={() => setParams({ chantier: null, ouvrier: null })} className="text-sm text-gray-500 hover:text-gray-800">
                Effacer les filtres
              </button>
            )}
            {conflicts.size > 0 && (
              <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-amber-100 text-[10px] font-bold">!</span>
                Doublons : {conflicts.size} affectation{conflicts.size > 1 ? 's' : ''} en conflit
              </span>
            )}
          </>
        }
        actions={
          canEdit && (
            <>
              {view !== 'month' && (
                <Button variant="secondary" size="sm" onClick={onCopyPreviousWeek} loading={copyWeek.isPending} className="hidden sm:inline-flex">
                  Copier sem. précédente
                </Button>
              )}
              <Button size="sm" onClick={() => openCreate()}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M12 5v14M5 12h14" strokeLinecap="round" />
                </svg>
                <span className="hidden sm:inline">Affectation</span>
              </Button>
            </>
          )
        }
      />

      {isLoading ? (
        <Spinner block />
      ) : view === 'month' ? (
        <MonthView
          cursor={cursor}
          affectations={affectations}
          conflicts={conflicts}
          canEdit={canEdit}
          onSelectDay={openDay}
          onCreateAt={openCreate}
          onSelectAffectation={openEdit}
          onMoveAffectation={moveAffectation}
        />
      ) : view === 'week' ? (
        <WeekView
          cursor={cursor}
          affectations={affectations}
          conflicts={conflicts}
          canEdit={canEdit}
          onCreateAt={openCreate}
          onSelectAffectation={openEdit}
          onMoveAffectation={moveAffectation}
        />
      ) : affectations.length === 0 ? (
        <div className="rounded-card border border-gray-200 bg-white shadow-sm">
          <EmptyState
            title="Aucune affectation cette semaine."
            description={canEdit ? 'Ajoute un chantier sur un jour, ou copie la semaine précédente.' : undefined}
            action={canEdit ? <Button onClick={() => openCreate()}>Nouvelle affectation</Button> : undefined}
          />
        </div>
      ) : (
        <AgendaList
          days={weekDaysList}
          affectations={affectations}
          conflicts={conflicts}
          canEdit={canEdit}
          onCreateAt={openCreate}
          onSelectAffectation={openEdit}
        />
      )}

      {canEdit && view !== 'month' && (
        <p className="mt-3 text-xs text-gray-400">Astuce : glisse une carte sur un autre jour pour la déplacer. Double-clic sur une case du mois pour créer.</p>
      )}

      <AffectationModal target={target} onClose={() => setTarget(null)} chantiers={chantiers} workers={workers} existing={affectations} />
    </div>
  )
}
