import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef } from 'react'
import FullCalendar from '@fullcalendar/react'
import type { DateSelectArg, DatesSetArg, EventClickArg, EventContentArg, EventDropArg, EventInput } from '@fullcalendar/core'
import frLocale from '@fullcalendar/core/locales/fr'
import dayGridPlugin from '@fullcalendar/daygrid'
import interactionPlugin from '@fullcalendar/interaction'
import type { EventResizeDoneArg } from '@fullcalendar/interaction'
import listPlugin from '@fullcalendar/list'
import resourcePlugin from '@fullcalendar/resource'
import type { ResourceLabelContentArg } from '@fullcalendar/resource'
import resourceTimelinePlugin from '@fullcalendar/resource-timeline'
import timeGridPlugin from '@fullcalendar/timegrid'
import { toKey } from '@/lib/dates'
import type { Affectation, AffectationPayload, Worker } from '@/types'
import Avatar, { colorFor } from '@/components/ui/Avatar'
import type { CalendarView } from '@/components/planning/CalendarToolbar'

/** Vues FullCalendar derrière chaque vue de la barre d'outils. */
const FC_VIEWS: Record<CalendarView, string> = {
  month: 'dayGridMonth',
  // Semaine en « cartes empilées » (lisible avec plusieurs chantiers par jour) ; le jour est horaire.
  week: 'dayGridWeek',
  day: 'timeGridDay',
  list: 'listWeek',
  team: 'resourceTimelineWeek',
}

/** Ressource virtuelle de la vue « Par ouvrier » pour les affectations sans équipe. */
const UNASSIGNED = '__unassigned__'

/** Clé Scheduler : commerciale via VITE_FC_LICENSE_KEY, sinon évaluation non commerciale (comme ela-planning). */
const LICENSE_KEY = import.meta.env.VITE_FC_LICENSE_KEY || 'CC-Attribution-NonCommercial-NoDerivatives'

export interface CalendarRange {
  from: string
  to: string
  /** Titre lisible de la période (« 21 – 27 sept. 2026 »). */
  title: string
  /** Premier jour de la période courante (pour l'URL). */
  current: Date
}

export interface CreateRequest {
  date: string
  start_time: string | null
  end_time: string | null
  /** Vue « Par ouvrier » : ligne sur laquelle on a cliqué. */
  workerId?: number
}

/** Ce qu'un glisser-déposer / redimensionnement demande à l'API. */
export interface MoveRequest {
  id: number
  patch: Partial<AffectationPayload>
  /** Vue « Par ouvrier » : changement de ligne (ouvrier). */
  workerChange?: { from: number | null; to: number | null }
}

export interface PlanningCalendarHandle {
  prev: () => void
  next: () => void
  today: () => void
  gotoDate: (d: Date) => void
}

interface PlanningCalendarProps {
  view: CalendarView
  initialDate: Date
  affectations: Affectation[]
  workers: Worker[]
  /** Clés « date:workerId » des ouvriers affectés deux fois le même jour. */
  conflicts: Set<string>
  canEdit: boolean
  onRangeChange: (range: CalendarRange) => void
  onCreate: (req: CreateRequest) => void
  onEdit: (a: Affectation) => void
  /** Doit rejeter (throw) en cas d'échec : l'événement est alors remis en place. */
  onMove: (req: MoveRequest) => Promise<unknown>
}

function hhmm(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function tint(color: string, pct: number): string {
  return `color-mix(in oklab, ${color} ${pct}%, white)`
}

/**
 * Calendrier du planning bâti sur FullCalendar (même bibliothèque qu'ela-planning) :
 * sélection d'une plage pour créer, clic pour modifier, glisser-déposer et
 * redimensionnement pour déplacer, vue « Par ouvrier » (timeline ressources) où
 * changer de ligne réaffecte la personne.
 */
const PlanningCalendar = forwardRef<PlanningCalendarHandle, PlanningCalendarProps>(function PlanningCalendar(
  { view, initialDate, affectations, workers, conflicts, canEdit, onRangeChange, onCreate, onEdit, onMove },
  ref,
) {
  const calRef = useRef<FullCalendar>(null)
  const api = () => calRef.current?.getApi()
  const byId = useMemo(() => new Map(affectations.map((a) => [a.id, a])), [affectations])
  const isTeam = view === 'team'

  useImperativeHandle(ref, () => ({
    prev: () => api()?.prev(),
    next: () => api()?.next(),
    today: () => api()?.today(),
    gotoDate: (d) => api()?.gotoDate(d),
  }))

  // Changement de vue piloté par la barre d'outils de l'app (le header FullCalendar est masqué).
  useEffect(() => {
    const a = api()
    if (a && a.view.type !== FC_VIEWS[view]) a.changeView(FC_VIEWS[view])
  }, [view])

  /* ---------------------------------------------------------------- données */

  const resources = useMemo(() => {
    if (!isTeam) return undefined
    return [
      ...workers.map((w) => ({
        id: String(w.id),
        title: w.name,
        extendedProps: { worker: w, order: 0 },
      })),
      // Toujours en dernière ligne (resourceOrder="order,title").
      { id: UNASSIGNED, title: 'Sans équipe', extendedProps: { worker: null, order: 1 } },
    ]
  }, [isTeam, workers])

  const events = useMemo<EventInput[]>(() => {
    const base = (a: Affectation) => {
      const color = a.chantier.color
      const timed = Boolean(a.start_time)
      const start = timed ? `${a.date}T${a.start_time}:00` : a.date
      const end = timed && a.end_time ? `${a.date}T${a.end_time}:00` : undefined
      const hasConflict = a.workers.some((w) => conflicts.has(`${a.date}:${w.id}`))
      return {
        title: a.chantier.name,
        start,
        end,
        allDay: !timed,
        backgroundColor: tint(color, 14),
        borderColor: color,
        textColor: `color-mix(in oklab, ${color} 70%, black)`,
        classNames: ['pc-event', hasConflict ? 'pc-event--conflict' : ''],
        extendedProps: { affectationId: a.id, color, hasConflict },
      }
    }

    if (!isTeam) return affectations.map((a) => ({ id: String(a.id), ...base(a) }))

    // Vue « Par ouvrier » : un événement par (affectation, ouvrier), en journée entière sur la timeline.
    return affectations.flatMap((a): EventInput[] => {
      const common = { ...base(a), allDay: true, start: a.date, end: undefined }
      if (a.workers.length === 0) {
        return [{ id: `${a.id}:${UNASSIGNED}`, resourceId: UNASSIGNED, ...common, extendedProps: { ...common.extendedProps, workerId: null } }]
      }
      return a.workers.map((w) => ({
        id: `${a.id}:${w.id}`,
        resourceId: String(w.id),
        ...common,
        classNames: [...common.classNames, conflicts.has(`${a.date}:${w.id}`) ? 'pc-event--conflict' : ''],
        extendedProps: { ...common.extendedProps, workerId: w.id },
      }))
    })
  }, [affectations, conflicts, isTeam])

  /* ------------------------------------------------------------ interactions */

  const handleDatesSet = useCallback(
    (arg: DatesSetArg) => {
      const last = new Date(arg.end)
      last.setDate(last.getDate() - 1) // `end` est exclusif
      onRangeChange({ from: toKey(arg.start), to: toKey(last), title: arg.view.title, current: arg.view.currentStart })
    },
    [onRangeChange],
  )

  const handleSelect = useCallback(
    (arg: DateSelectArg) => {
      api()?.unselect()
      const workerId = arg.resource && arg.resource.id !== UNASSIGNED ? Number(arg.resource.id) : undefined
      if (arg.allDay) {
        onCreate({ date: toKey(arg.start), start_time: null, end_time: null, workerId })
        return
      }
      const sameDay = toKey(arg.start) === toKey(new Date(arg.end.getTime() - 1))
      onCreate({
        date: toKey(arg.start),
        start_time: hhmm(arg.start),
        end_time: sameDay ? hhmm(arg.end) : null,
        workerId,
      })
    },
    [onCreate],
  )

  const handleEventClick = useCallback(
    (arg: EventClickArg) => {
      const a = byId.get(Number(arg.event.extendedProps.affectationId))
      if (a) onEdit(a)
    },
    [byId, onEdit],
  )

  const handleChange = useCallback(
    async (arg: EventDropArg | EventResizeDoneArg) => {
      const ev = arg.event
      const id = Number(ev.extendedProps.affectationId)
      const a = byId.get(id)
      if (!a || !ev.start) return arg.revert()

      const patch: Partial<AffectationPayload> = { date: toKey(ev.start) }
      if (!isTeam) {
        if (ev.allDay) {
          patch.start_time = null
          patch.end_time = null
        } else {
          patch.start_time = hhmm(ev.start)
          // Sans heure de fin, FullCalendar ne renvoie pas `end` : on garde la durée existante.
          patch.end_time = ev.end ? hhmm(ev.end) : a.end_time
        }
      }

      let workerChange: MoveRequest['workerChange']
      if ('newResource' in arg && arg.newResource && arg.oldResource && arg.newResource.id !== arg.oldResource.id) {
        const to = arg.newResource.id === UNASSIGNED ? null : Number(arg.newResource.id)
        const from = arg.oldResource.id === UNASSIGNED ? null : Number(arg.oldResource.id)
        workerChange = { from, to }
        const ids = a.workers.map((w) => w.id).filter((wid) => wid !== from)
        if (to !== null && !ids.includes(to)) ids.push(to)
        patch.worker_ids = ids
      }

      try {
        await onMove({ id, patch, workerChange })
      } catch {
        arg.revert()
      }
    },
    [byId, isTeam, onMove],
  )

  /* ---------------------------------------------------------------- rendu */

  const renderEvent = useCallback(
    (arg: EventContentArg) => {
      const a = byId.get(Number(arg.event.extendedProps.affectationId))
      const conflict = Boolean(arg.event.extendedProps.hasConflict)
      const color = String(arg.event.extendedProps.color)
      const type = arg.view.type
      // Mois et timeline : une ligne par carte. Semaine (cartes empilées) et jour : titre + horaire + équipe.
      const compact = type === 'dayGridMonth' || type.startsWith('resourceTimeline')

      if (type.startsWith('list')) {
        return (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="font-semibold text-gray-900">{arg.event.title}</span>
            {a?.chantier.city && <span className="text-xs text-gray-500">{a.chantier.city}</span>}
            {a && a.workers.length > 0 && (
              <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-700">
                {a.workers.map((w) => (
                  <span key={w.id} className="inline-flex items-center gap-1">
                    <Avatar name={w.name} color={w.color} size="xs" />
                    {w.name}
                  </span>
                ))}
              </span>
            )}
            {a?.note && <span className="w-full text-xs italic text-gray-500">{a.note}</span>}
          </div>
        )
      }

      return (
        <div className="pc-event__inner" title={a ? `${a.chantier.name} · ${a.workers.map((w) => w.name).join(', ') || 'Personne'}` : undefined}>
          <div className="pc-event__head">
            <span className="pc-event__dot" style={{ backgroundColor: color }} />
            <span className="pc-event__title">{arg.event.title}</span>
            {conflict && <span className="pc-event__conflict" title="Ouvrier affecté deux fois ce jour">!</span>}
            {!compact && arg.timeText && <span className="pc-event__time">{arg.timeText}</span>}
          </div>
          {!compact && a && (
            <div className="pc-event__people">
              {a.workers.length === 0 ? (
                <span className="italic opacity-60">Personne</span>
              ) : (
                a.workers.slice(0, 6).map((w) => (
                  <span key={w.id} className="pc-event__avatar" style={{ backgroundColor: colorFor(w.name, w.color) }} title={w.name}>
                    {w.name
                      .split(/\s+/)
                      .slice(0, 2)
                      .map((p) => p[0]?.toUpperCase())
                      .join('')}
                  </span>
                ))
              )}
              {a.workers.length > 6 && <span className="pc-event__more">+{a.workers.length - 6}</span>}
            </div>
          )}
          {compact && a && type === 'dayGridMonth' && <span className="pc-event__count">{a.workers.length}</span>}
        </div>
      )
    },
    [byId],
  )

  const renderResource = useCallback((arg: ResourceLabelContentArg) => {
    const w = arg.resource.extendedProps.worker as Worker | null
    if (!w) return <span className="text-sm italic text-gray-500">Sans équipe</span>
    return (
      <span className="flex items-center gap-2">
        <Avatar name={w.name} color={w.color} size="sm" />
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium text-gray-900">{w.name}</span>
          <span className="block truncate text-[11px] text-gray-500">{w.job_title ?? '—'}</span>
        </span>
      </span>
    )
  }, [])

  return (
    <div className="pc-calendar overflow-hidden rounded-card border border-gray-200 bg-white shadow-sm">
      <FullCalendar
        ref={calRef}
        plugins={[interactionPlugin, dayGridPlugin, timeGridPlugin, listPlugin, resourcePlugin, resourceTimelinePlugin]}
        schedulerLicenseKey={LICENSE_KEY}
        locale={frLocale}
        firstDay={1}
        timeZone="local"
        initialView={FC_VIEWS[view]}
        initialDate={initialDate}
        headerToolbar={false}
        height="auto"
        expandRows
        nowIndicator
        weekNumbers={false}
        moreLinkText={(n) => `+ ${n} autre${n > 1 ? 's' : ''}`}
        slotEventOverlap={false}
        slotMinTime="06:00:00"
        slotMaxTime="20:00:00"
        slotDuration="00:30:00"
        snapDuration="00:15:00"
        slotLabelFormat={{ hour: '2-digit', minute: '2-digit', hour12: false }}
        eventTimeFormat={{ hour: '2-digit', minute: '2-digit', hour12: false }}
        allDaySlot
        allDayText="Journée"
        views={{
          dayGridMonth: { dayMaxEvents: 4 },
          dayGridWeek: { dayMaxEvents: false, dayHeaderFormat: { weekday: 'short', day: 'numeric', month: 'numeric' } },
          resourceTimelineWeek: {
            slotDuration: { days: 1 },
            slotLabelFormat: [{ weekday: 'short', day: 'numeric' }],
            resourceAreaHeaderContent: 'Équipe',
            resourceAreaWidth: '240px',
          },
        }}
        resources={resources}
        resourceOrder="order,title"
        resourceLabelContent={renderResource}
        events={events}
        eventContent={renderEvent}
        eventOrder="start,title"
        editable={canEdit}
        eventStartEditable={canEdit}
        eventDurationEditable={canEdit && !isTeam}
        eventResourceEditable={canEdit}
        droppable={false}
        selectable={canEdit}
        selectMirror
        unselectAuto
        select={handleSelect}
        eventClick={handleEventClick}
        eventDrop={handleChange}
        eventResize={handleChange}
        datesSet={handleDatesSet}
        noEventsText="Aucune affectation sur cette période."
      />
    </div>
  )
})

export default PlanningCalendar
