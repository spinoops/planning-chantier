import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/auth/AuthContext'
import { useAbsences } from '@/hooks/useAbsences'
import { useOpenChantiers } from '@/hooks/useChantiers'
import { useEquipes } from '@/hooks/useEquipes'
import { useCopyWeek, usePlanning, useUpdateAffectation } from '@/hooks/usePlanning'
import { useWorkers } from '@/hooks/useWorkers'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { getErrorMessage } from '@/lib/errors'
import { addDays, fromKey, isoWeek, startOfWeek, timesOverlap, toKey, todayKey } from '@/lib/dates'
import { isPlanner } from '@/lib/navigation'
import { toast } from '@/lib/toast'
import type { Affectation, AffectationPayload } from '@/types'
import Button from '@/components/ui/Button'
import Select from '@/components/ui/Select'
import AffectationModal from '@/components/planning/AffectationModal'
import type { AffectationTarget } from '@/components/planning/AffectationModal'
import CalendarToolbar from '@/components/planning/CalendarToolbar'
import type { CalendarView } from '@/components/planning/CalendarToolbar'
import PlanningCalendar from '@/components/planning/PlanningCalendar'
import type { CalendarRange, CreateRequest, DropOnEventRequest, MoveRequest, PlanningCalendarHandle } from '@/components/planning/PlanningCalendar'
import TeamSidebar, { NO_TEAM } from '@/components/planning/TeamSidebar'
import type { TeamKey } from '@/components/planning/TeamSidebar'

const VIEW_KEY = 'planning_view'
const HIDDEN_KEY = 'planning_hidden_equipes'
const ALL_VIEWS: CalendarView[] = ['month', 'week', 'day', 'list', 'team']

function defaultView(): CalendarView {
  try {
    const stored = localStorage.getItem(VIEW_KEY) as CalendarView | null
    if (stored && ALL_VIEWS.includes(stored)) return stored
  } catch {
    // stockage indisponible
  }
  // Par défaut : la semaine en grille horaire, une colonne par équipe sous chaque jour.
  return typeof window !== 'undefined' && window.innerWidth < 768 ? 'list' : 'week'
}

function loadHidden(): Set<TeamKey> {
  try {
    const raw = localStorage.getItem(HIDDEN_KEY)
    if (raw) return new Set(JSON.parse(raw) as TeamKey[])
  } catch {
    // ignore
  }
  return new Set()
}

/**
 * Planning (planificateurs) : à gauche les équipes (couleur + case pour les
 * afficher ou non), à droite le calendrier FullCalendar. Vue semaine horaire
 * façon Apple Calendrier : sélectionner une plage crée une affectation pour
 * une équipe, glisser-déposer / étirer déplace et change l'horaire.
 * L'état (vue, date, chantier) vit dans l'URL : ?view=week&d=2026-09-21&chantier=3.
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

  // Équipes masquées dans le calendrier (persisté par navigateur).
  const [hidden, setHidden] = useState<Set<TeamKey>>(loadHidden)
  useEffect(() => {
    try {
      localStorage.setItem(HIDDEN_KEY, JSON.stringify([...hidden]))
    } catch {
      // ignore
    }
  }, [hidden])

  // Week-end affiché ou non (persisté par navigateur) : par défaut lundi → vendredi.
  const [weekends, setWeekends] = useState<boolean>(() => {
    try {
      return localStorage.getItem('planning_weekends') === '1'
    } catch {
      return false
    }
  })
  useEffect(() => {
    try {
      localStorage.setItem('planning_weekends', weekends ? '1' : '0')
    } catch {
      // ignore
    }
  }, [weekends])

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
  const { data: loaded = [], isLoading, isFetching } = usePlanning({ ...query, chantier_id: chantierFilter || undefined }, range !== null)
  const { data: chantiers = [] } = useOpenChantiers()
  const { data: equipes = [] } = useEquipes()
  const { data: absences = [] } = useAbsences(query, range !== null)
  const { data: workers = [] } = useWorkers(canEdit)
  const updateAffectation = useUpdateAffectation()
  const copyWeek = useCopyWeek()

  const [target, setTarget] = useState<AffectationTarget | null>(null)

  const teamKey = (a: Affectation): TeamKey => a.equipe_id ?? NO_TEAM
  const affectations = useMemo(() => loaded.filter((a) => !hidden.has(teamKey(a))), [loaded, hidden])

  const counts = useMemo(() => {
    const map = new Map<TeamKey, number>()
    for (const a of loaded) map.set(teamKey(a), (map.get(teamKey(a)) ?? 0) + 1)
    return map
  }, [loaded])

  // Doublons : une personne sur deux créneaux qui se chevauchent le même jour
  // (deux demi-journées ne comptent pas). Calculé sur tout ce qui est chargé, même masqué.
  const conflicts = useMemo(() => {
    const byWorkerDay = new Map<string, Affectation[]>()
    for (const a of loaded) {
      for (const w of a.workers) {
        const key = `${a.date}:${w.id}`
        byWorkerDay.set(key, [...(byWorkerDay.get(key) ?? []), a])
      }
    }
    const set = new Set<string>()
    for (const [key, list] of byWorkerDay) {
      if (list.some((a, i) => list.some((b, j) => j > i && timesOverlap(a, b)))) set.add(key)
    }
    return set
  }, [loaded])

  const onCreate = useCallback((req: CreateRequest) => {
    setTarget({ date: req.date, start_time: req.start_time, end_time: req.end_time, equipeId: req.equipeId, workerIds: req.workerIds })
  }, [])

  const onEdit = useCallback((a: Affectation) => setTarget({ affectation: a }), [])

  const onMove = useCallback(
    async (req: MoveRequest) => {
      const current = loaded.find((a) => a.id === req.id)
      try {
        await updateAffectation.mutateAsync({ id: req.id, payload: req.patch })
        if (req.equipeChange) {
          const to = equipes.find((e) => e.id === req.equipeChange?.to)
          toast(to ? `${current?.chantier.name ?? 'Affectation'} → équipe ${to.name}.` : `${current?.chantier.name ?? 'Affectation'} sans équipe.`, 'success')
        } else {
          toast(`${current?.chantier.name ?? 'Affectation'} déplacé.`, 'success')
        }
      } catch (err) {
        toast(getErrorMessage(err, 'Déplacement impossible.'), 'error')
        throw err
      }
    },
    [loaded, updateAffectation, equipes],
  )

  // Glisser depuis la colonne de gauche : les cartes survolées se mettent en évidence,
  // et un dépôt sur une carte ajoute l'équipe / la personne à cette affectation.
  const [externalDragging, setExternalDragging] = useState(false)
  const onDropOnEvent = useCallback(
    (req: DropOnEventRequest) => {
      const a = loaded.find((x) => x.id === req.affectationId)
      if (!a) return
      const team = req.kind === 'team' ? equipes.find((e) => e.id === req.id) : undefined
      const adding = req.kind === 'team' ? (team?.members.map((m) => m.id) ?? []) : [req.id]
      const current = a.workers.map((w) => w.id)
      const worker_ids = [...new Set([...current, ...adding])]
      if (worker_ids.length === current.length) {
        toast('Déjà sur cette affectation.', 'info')
        return
      }
      const payload: Partial<AffectationPayload> = { worker_ids }
      // Une équipe déposée sur une affectation sans équipe la lui attribue (couleur, ligne « Par équipe »).
      if (team && !a.equipe_id) payload.equipe_id = team.id
      const label = team ? `Équipe ${team.name}` : (workers.find((w) => w.id === req.id)?.name.split(' ')[0] ?? 'Personne')
      updateAffectation.mutate(
        { id: a.id, payload },
        {
          onSuccess: () => toast(`${label} ajouté(e) à ${a.chantier.name}.`, 'success'),
          onError: (err) => toast(getErrorMessage(err, 'Ajout impossible.'), 'error'),
        },
      )
    },
    [loaded, equipes, workers, updateAffectation],
  )

  async function onCopyPreviousWeek() {
    const monday = startOfWeek(range?.current ?? new Date())
    const from = toKey(addDays(monday, -7))
    const to = toKey(monday)
    const ok = await confirm({
      title: 'Copier la semaine précédente ?',
      message:
        loaded.length > 0
          ? 'Les affectations de la semaine précédente seront ajoutées à celles déjà présentes cette semaine.'
          : 'Chantiers, équipes, horaires et notes de la semaine précédente seront recopiés sur cette semaine.',
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
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
      <div className="lg:sticky lg:top-20 lg:w-64 lg:shrink-0">
        <TeamSidebar
          equipes={equipes}
          workers={workers}
          hidden={hidden}
          counts={counts}
          canManage={canEdit}
          onToggle={(key) =>
            setHidden((prev) => {
              const next = new Set(prev)
              if (next.has(key)) next.delete(key)
              else next.add(key)
              return next
            })
          }
          onOnly={(key) => setHidden(new Set<TeamKey>([...equipes.map((e) => e.id as TeamKey), NO_TEAM].filter((k) => k !== key)))}
          onShowAll={() => setHidden(new Set())}
          onDraggingChange={setExternalDragging}
        />
      </div>

      <div className="min-w-0 flex-1">
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
              {chantierFilter !== 0 && (
                <button type="button" onClick={() => setParams({ chantier: null })} className="text-sm text-gray-500 hover:text-gray-800">
                  Effacer le filtre
                </button>
              )}
              {view !== 'month' && view !== 'day' && (
                <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-gray-600">
                  <input type="checkbox" checked={weekends} onChange={(e) => setWeekends(e.target.checked)} className="h-4 w-4 rounded border-gray-300 accent-primary" />
                  Week-end
                </label>
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
                <Link
                  to={`/planning/print?d=${toKey(range?.current ?? new Date())}`}
                  className="hidden h-8 items-center justify-center rounded-lg border border-gray-300 bg-white px-2.5 text-xs font-medium text-gray-700 transition hover:bg-gray-50 sm:inline-flex"
                  title="Imprimer la semaine (une page par équipe)"
                >
                  Imprimer
                </Link>
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
          equipes={equipes.filter((e) => !hidden.has(e.id))}
          conflicts={conflicts}
          canEdit={canEdit}
          onRangeChange={onRangeChange}
          onCreate={onCreate}
          onEdit={onEdit}
          onMove={onMove}
          externalDragging={externalDragging}
          onDropOnEvent={onDropOnEvent}
          absences={absences}
          weekends={weekends}
        />

        {canEdit && (
          <p className="mt-3 text-xs text-gray-400">
            Astuce : sélectionne une plage horaire pour créer, glisse une carte pour la déplacer, étire-la pour changer l'horaire. En vue « Par équipe »,
            glisse une carte sur une autre ligne pour changer d'équipe.
          </p>
        )}

        <AffectationModal target={target} onClose={() => setTarget(null)} chantiers={chantiers} equipes={equipes} workers={workers} existing={loaded} absences={absences} />
      </div>
    </div>
  )
}
