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
import AffectationModal from '@/components/planning/AffectationModal'
import type { AffectationTarget } from '@/components/planning/AffectationModal'
import CalendarToolbar from '@/components/planning/CalendarToolbar'
import type { CalendarView } from '@/components/planning/CalendarToolbar'
import ChantierSidebar from '@/components/planning/ChantierSidebar'
import PlanningCalendar from '@/components/planning/PlanningCalendar'
import type { CalendarRange, CreateRequest, DropOnEventRequest, MoveRequest, PlanningCalendarHandle } from '@/components/planning/PlanningCalendar'
import TeamSidebar, { NO_TEAM } from '@/components/planning/TeamSidebar'
import type { TeamKey } from '@/components/planning/TeamSidebar'

const VIEW_KEY = 'planning_view'
const HIDDEN_TEAMS_KEY = 'planning_hidden_equipes'
const HIDDEN_SITES_KEY = 'planning_hidden_chantiers'
const ALL_VIEWS: CalendarView[] = ['month', 'week', 'day', 'list', 'team', 'site']

function defaultView(): CalendarView {
  try {
    const stored = localStorage.getItem(VIEW_KEY) as CalendarView | null
    if (stored && ALL_VIEWS.includes(stored)) return stored
  } catch {
    // stockage indisponible
  }
  return typeof window !== 'undefined' && window.innerWidth < 768 ? 'list' : 'week'
}

function loadSet<T>(key: string): Set<T> {
  try {
    const raw = localStorage.getItem(key)
    if (raw) return new Set(JSON.parse(raw) as T[])
  } catch {
    // ignore
  }
  return new Set()
}

function saveSet<T>(key: string, set: Set<T>): void {
  try {
    localStorage.setItem(key, JSON.stringify([...set]))
  } catch {
    // ignore
  }
}

/**
 * Planning (planificateurs) : à gauche un calendrier par chantier (couleur +
 * case pour l'afficher) et les équipes (glisser-déposer), à droite le calendrier
 * FullCalendar. Les cartes prennent la couleur du chantier et montrent les
 * personnes affectées. L'état (vue, date) vit dans l'URL : ?view=week&d=2026-09-21.
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

  // Équipes et chantiers masqués dans le calendrier (persistés par navigateur).
  const [hiddenTeams, setHiddenTeams] = useState<Set<TeamKey>>(() => loadSet<TeamKey>(HIDDEN_TEAMS_KEY))
  const [hiddenSites, setHiddenSites] = useState<Set<number>>(() => loadSet<number>(HIDDEN_SITES_KEY))
  useEffect(() => saveSet(HIDDEN_TEAMS_KEY, hiddenTeams), [hiddenTeams])
  useEffect(() => saveSet(HIDDEN_SITES_KEY, hiddenSites), [hiddenSites])

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
  const { data: loaded = [], isLoading, isFetching } = usePlanning(query, range !== null)
  const { data: chantiers = [] } = useOpenChantiers()
  const { data: equipes = [] } = useEquipes()
  const { data: absences = [] } = useAbsences(query, range !== null)
  const { data: workers = [] } = useWorkers(canEdit)
  const updateAffectation = useUpdateAffectation()
  const copyWeek = useCopyWeek()

  const [target, setTarget] = useState<AffectationTarget | null>(null)

  // Chantiers à lister à gauche : les chantiers ouverts + ceux (terminés) qui ont encore des affectations sur la période.
  const sidebarChantiers = useMemo(() => {
    const extra = loaded.map((a) => a.chantier).filter((c) => !chantiers.some((o) => o.id === c.id))
    const seen = new Set<number>()
    return [...chantiers, ...extra].filter((c) => (seen.has(c.id) ? false : (seen.add(c.id), true)))
  }, [chantiers, loaded])

  // Lien « voir dans le planning » depuis la page Chantiers : ?chantier=ID → seul ce chantier affiché,
  // tant que l'utilisateur n'a pas touché aux cases (le premier clic retire le paramètre).
  const chantierParam = Number(searchParams.get('chantier')) || 0
  const effectiveHiddenSites = useMemo(
    () => (chantierParam ? new Set(sidebarChantiers.filter((c) => c.id !== chantierParam).map((c) => c.id)) : hiddenSites),
    [chantierParam, sidebarChantiers, hiddenSites],
  )
  const updateHiddenSites = useCallback(
    (next: Set<number>) => {
      if (chantierParam) setParams({ chantier: null })
      setHiddenSites(next)
    },
    [chantierParam, setParams],
  )

  const teamKey = (a: Affectation): TeamKey => a.equipe_id ?? NO_TEAM
  const affectations = useMemo(
    () => loaded.filter((a) => !hiddenTeams.has(teamKey(a)) && !effectiveHiddenSites.has(a.chantier_id)),
    [loaded, hiddenTeams, effectiveHiddenSites],
  )

  const teamCounts = useMemo(() => {
    const map = new Map<TeamKey, number>()
    for (const a of loaded) map.set(teamKey(a), (map.get(teamKey(a)) ?? 0) + 1)
    return map
  }, [loaded])
  const siteCounts = useMemo(() => {
    const map = new Map<number, number>()
    for (const a of loaded) map.set(a.chantier_id, (map.get(a.chantier_id) ?? 0) + 1)
    return map
  }, [loaded])

  // Doublons : une personne sur deux créneaux qui se chevauchent le même jour (calculé sur tout ce qui est chargé).
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
    setTarget({ date: req.date, start_time: req.start_time, end_time: req.end_time, equipeId: req.equipeId, chantierId: req.chantierId, workerIds: req.workerIds })
  }, [])

  const onEdit = useCallback((a: Affectation) => setTarget({ affectation: a }), [])

  const onMove = useCallback(
    async (req: MoveRequest) => {
      const current = loaded.find((a) => a.id === req.id)
      const name = current?.chantier.name ?? 'Affectation'
      try {
        await updateAffectation.mutateAsync({ id: req.id, payload: req.patch })
        if (req.equipeChange) {
          const to = equipes.find((e) => e.id === req.equipeChange?.to)
          toast(to ? `${name} → équipe ${to.name}.` : `${name} sans équipe.`, 'success')
        } else if (req.chantierChange) {
          const to = chantiers.find((c) => c.id === req.chantierChange?.to)
          toast(`Équipe déplacée sur ${to?.name ?? 'un autre chantier'}.`, 'success')
        } else {
          toast(`${name} déplacé.`, 'success')
        }
      } catch (err) {
        toast(getErrorMessage(err, 'Déplacement impossible.'), 'error')
        throw err
      }
    },
    [loaded, updateAffectation, equipes, chantiers],
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
  const toggle = <T,>(set: (fn: (prev: Set<T>) => Set<T>) => void, key: T) =>
    set((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
      <div className="space-y-4 lg:sticky lg:top-20 lg:w-64 lg:shrink-0">
        <ChantierSidebar
          chantiers={sidebarChantiers}
          hidden={effectiveHiddenSites}
          counts={siteCounts}
          canManage={canEdit}
          onToggle={(id) => {
            const next = new Set(effectiveHiddenSites)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            updateHiddenSites(next)
          }}
          onOnly={(id) => updateHiddenSites(new Set(sidebarChantiers.filter((c) => c.id !== id).map((c) => c.id)))}
          onShowAll={() => updateHiddenSites(new Set())}
        />
        <TeamSidebar
          equipes={equipes}
          workers={workers}
          hidden={hiddenTeams}
          counts={teamCounts}
          canManage={canEdit}
          onToggle={(key) => toggle(setHiddenTeams, key)}
          onOnly={(key) => setHiddenTeams(new Set<TeamKey>([...equipes.map((e) => e.id as TeamKey), NO_TEAM].filter((k) => k !== key)))}
          onShowAll={() => setHiddenTeams(new Set())}
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
              {(effectiveHiddenSites.size > 0 || hiddenTeams.size > 0) && (
                <span className="text-xs text-gray-500">
                  {effectiveHiddenSites.size > 0 && `${effectiveHiddenSites.size} chantier${effectiveHiddenSites.size > 1 ? 's' : ''} masqué${effectiveHiddenSites.size > 1 ? 's' : ''}`}
                  {effectiveHiddenSites.size > 0 && hiddenTeams.size > 0 && ' · '}
                  {hiddenTeams.size > 0 && `${hiddenTeams.size} équipe${hiddenTeams.size > 1 ? 's' : ''} masquée${hiddenTeams.size > 1 ? 's' : ''}`}
                  <button
                    type="button"
                    onClick={() => {
                      updateHiddenSites(new Set())
                      setHiddenTeams(new Set())
                    }}
                    className="ml-2 font-medium text-primary hover:underline"
                  >
                    Tout afficher
                  </button>
                </span>
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
                  className="glass-pill hidden h-9 items-center justify-center rounded-full px-4 text-sm font-medium text-gray-900 active:scale-[0.96] sm:inline-flex"
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
          equipes={equipes.filter((e) => !hiddenTeams.has(e.id))}
          chantiers={sidebarChantiers.filter((c) => !effectiveHiddenSites.has(c.id))}
          conflicts={conflicts}
          canEdit={canEdit}
          onRangeChange={onRangeChange}
          onCreate={onCreate}
          onEdit={onEdit}
          onMove={onMove}
          externalDragging={externalDragging}
          onDropOnEvent={onDropOnEvent}
          absences={absences}
        />

        {canEdit && (
          <p className="mt-3 text-xs text-gray-400">
            Astuce : coche à gauche les chantiers et équipes à afficher (double-clic : un seul). Sélectionne une plage pour créer, glisse une carte pour la
            déplacer, étire-la pour changer l'horaire. Glisse une équipe ou une personne depuis la colonne de gauche sur un créneau ou sur une carte.
          </p>
        )}

        <AffectationModal target={target} onClose={() => setTarget(null)} chantiers={chantiers} equipes={equipes} workers={workers} existing={loaded} absences={absences} />
      </div>
    </div>
  )
}
