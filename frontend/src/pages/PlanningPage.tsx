import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '@/auth/AuthContext'
import { useOpenChantiers } from '@/hooks/useChantiers'
import { useCopyWeek, usePlanning, useUpdateAffectation } from '@/hooks/usePlanning'
import { useWorkers } from '@/hooks/useWorkers'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { getErrorMessage } from '@/lib/errors'
import { addDays, fromKey, isoWeek, startOfWeek, toKey, todayKey } from '@/lib/dates'
import { isPlanner } from '@/lib/navigation'
import { toast } from '@/lib/toast'
import type { Affectation } from '@/types'
import Button from '@/components/ui/Button'
import Select from '@/components/ui/Select'
import AffectationModal from '@/components/planning/AffectationModal'
import type { AffectationTarget } from '@/components/planning/AffectationModal'
import CalendarToolbar from '@/components/planning/CalendarToolbar'
import type { CalendarView } from '@/components/planning/CalendarToolbar'
import PlanningCalendar from '@/components/planning/PlanningCalendar'
import type { CalendarRange, CreateRequest, MoveRequest, PlanningCalendarHandle } from '@/components/planning/PlanningCalendar'

const VIEW_KEY = 'planning_view'
const ALL_VIEWS: CalendarView[] = ['month', 'week', 'day', 'list', 'team']

function defaultView(): CalendarView {
  try {
    const stored = localStorage.getItem(VIEW_KEY) as CalendarView | null
    if (stored && ALL_VIEWS.includes(stored)) return stored
  } catch {
    // stockage indisponible
  }
  return typeof window !== 'undefined' && window.innerWidth < 768 ? 'list' : 'week'
}

/**
 * Calendrier du planning (planificateurs), sur FullCalendar : vues mois / semaine /
 * jour / liste / par ouvrier, filtres par chantier et par ouvrier, création en
 * sélectionnant une plage, déplacement et redimensionnement par glisser-déposer,
 * copie de la semaine précédente. L'état (vue, date, filtres) vit dans l'URL :
 * ?view=week&d=2026-09-21&chantier=3&ouvrier=5.
 */
export default function PlanningPage() {
  const { user } = useAuth()
  const canEdit = isPlanner(user)
  const [searchParams, setSearchParams] = useSearchParams()
  const confirm = useConfirm()
  const calendar = useRef<PlanningCalendarHandle>(null)

  const viewParam = searchParams.get('view') as CalendarView | null
  const view = viewParam && ALL_VIEWS.includes(viewParam) ? viewParam : defaultView()
  const [initialDate] = useState(() => fromKey(searchParams.get('d') ?? todayKey()))
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

  // Période visible, fournie par FullCalendar (datesSet) : pilote le chargement et l'URL.
  const [range, setRange] = useState<CalendarRange | null>(null)
  const onRangeChange = useCallback(
    (r: CalendarRange) => {
      setRange(r)
      setParams({ d: toKey(r.current) })
    },
    [setParams],
  )

  const query = { from: range?.from ?? todayKey(), to: range?.to ?? todayKey() }
  const { data: affectations = [], isLoading, isFetching } = usePlanning(
    { ...query, chantier_id: chantierFilter || undefined, worker_id: workerFilter || undefined },
    range !== null,
  )
  // Pour signaler les doublons du jour on a besoin de tout le monde, même filtré.
  const { data: allAffectations = [] } = usePlanning(query, range !== null && Boolean(chantierFilter || workerFilter))
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

  const onCreate = useCallback((req: CreateRequest) => {
    setTarget({ date: req.date, start_time: req.start_time, end_time: req.end_time, workerIds: req.workerId ? [req.workerId] : [] })
  }, [])

  const onEdit = useCallback((a: Affectation) => setTarget({ affectation: a }), [])

  const onMove = useCallback(
    async (req: MoveRequest) => {
      const current = affectations.find((a) => a.id === req.id)
      try {
        await updateAffectation.mutateAsync({ id: req.id, payload: req.patch })
        if (req.workerChange) {
          const to = workers.find((w) => w.id === req.workerChange?.to)
          toast(to ? `${current?.chantier.name ?? 'Affectation'} : ${to.name} affecté(e).` : 'Personne retirée de l’affectation.', 'success')
        } else {
          toast(`${current?.chantier.name ?? 'Affectation'} déplacé.`, 'success')
        }
      } catch (err) {
        toast(getErrorMessage(err, 'Déplacement impossible.'), 'error')
        throw err
      }
    },
    [affectations, updateAffectation, workers],
  )

  async function onCopyPreviousWeek() {
    const monday = startOfWeek(range?.current ?? new Date())
    const from = toKey(addDays(monday, -7))
    const to = toKey(monday)
    const ok = await confirm({
      title: 'Copier la semaine précédente ?',
      message:
        affectations.length > 0
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

  const subtitle = range && view !== 'month' ? `Semaine ${isoWeek(range.current)}` : undefined
  const newDate = () => {
    const t = todayKey()
    return range && range.from <= t && t <= range.to ? t : toKey(range?.current ?? new Date())
  }

  return (
    <div>
      <CalendarToolbar
        title={range?.title ?? ''}
        subtitle={subtitle}
        view={view}
        onViewChange={(v) => setParams({ view: v })}
        onPrev={() => calendar.current?.prev()}
        onNext={() => calendar.current?.next()}
        onToday={() => calendar.current?.today()}
        busy={isFetching || isLoading}
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
            {canEdit && view !== 'team' && (
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
                Doublons : {conflicts.size} personne{conflicts.size > 1 ? 's' : ''} affectée{conflicts.size > 1 ? 's' : ''} deux fois
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
              <Button size="sm" onClick={() => setTarget({ date: newDate() })}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M12 5v14M5 12h14" strokeLinecap="round" />
                </svg>
                <span className="hidden sm:inline">Affectation</span>
              </Button>
            </>
          )
        }
      />

      <PlanningCalendar
        ref={calendar}
        view={view}
        initialDate={initialDate}
        affectations={affectations}
        workers={view === 'team' && workerFilter ? workers.filter((w) => w.id === workerFilter) : workers}
        conflicts={conflicts}
        canEdit={canEdit}
        onRangeChange={onRangeChange}
        onCreate={onCreate}
        onEdit={onEdit}
        onMove={onMove}
      />

      {canEdit && (
        <p className="mt-3 text-xs text-gray-400">
          Astuce : sélectionne une plage pour créer, glisse une carte pour la déplacer, étire-la pour changer l'horaire. En vue « Par ouvrier », glisse une
          carte sur une autre ligne pour changer de personne.
        </p>
      )}

      <AffectationModal target={target} onClose={() => setTarget(null)} chantiers={chantiers} workers={workers} existing={affectations} />
    </div>
  )
}
