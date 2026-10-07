import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef } from 'react'
import FullCalendar from '@fullcalendar/react'
import type { DateSelectArg, DatesSetArg, EventClickArg, EventContentArg, EventDropArg, EventInput } from '@fullcalendar/core'
import frLocale from '@fullcalendar/core/locales/fr'
import dayGridPlugin from '@fullcalendar/daygrid'
import interactionPlugin from '@fullcalendar/interaction'
import type { DropArg, EventResizeDoneArg } from '@fullcalendar/interaction'
import listPlugin from '@fullcalendar/list'
import resourcePlugin from '@fullcalendar/resource'
import type { ResourceLabelContentArg } from '@fullcalendar/resource'
import resourceTimelinePlugin from '@fullcalendar/resource-timeline'
import timeGridPlugin from '@fullcalendar/timegrid'
import { toKey } from '@/lib/dates'
import type { Affectation, AffectationPayload, Equipe } from '@/types'
import Avatar, { AvatarGroup } from '@/components/ui/Avatar'
import type { CalendarView } from '@/components/planning/CalendarToolbar'

/** Vues FullCalendar derrière chaque vue de la barre d'outils. */
const FC_VIEWS: Record<CalendarView, string> = {
  month: 'dayGridMonth',
  // Semaine horaire (comme Apple Calendrier) : les équipes se placent côte à côte.
  week: 'timeGridWeek',
  day: 'timeGridDay',
  list: 'listWeek',
  team: 'resourceTimelineWeek',
}

/** Ressource virtuelle de la vue « Par équipe » pour les affectations sans équipe. */
const UNASSIGNED = '__unassigned__'
const NO_TEAM_COLOR = '#9ca3af'

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
  /** Vue « Par équipe » : ligne sur laquelle on a cliqué, ou équipe déposée depuis la colonne de gauche. */
  equipeId?: number
  /** Personne déposée depuis la colonne de gauche (affectation individuelle). */
  workerIds?: number[]
}

/** Ce qu'un glisser-déposer / redimensionnement demande à l'API. */
export interface MoveRequest {
  id: number
  patch: Partial<AffectationPayload>
  /** Vue « Par équipe » : changement de ligne. */
  equipeChange?: { from: number | null; to: number | null }
}

/** Dépôt d'une équipe / personne de la colonne de gauche sur une carte existante. */
export interface DropOnEventRequest {
  affectationId: number
  kind: 'team' | 'person'
  id: number
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
  equipes: Equipe[]
  /** Clés « date:workerId » des ouvriers affectés deux fois le même jour. */
  conflicts: Set<string>
  canEdit: boolean
  onRangeChange: (range: CalendarRange) => void
  onCreate: (req: CreateRequest) => void
  onEdit: (a: Affectation) => void
  /** Doit rejeter (throw) en cas d'échec : l'événement est alors remis en place. */
  onMove: (req: MoveRequest) => Promise<unknown>
  /** Vrai pendant un glisser depuis la colonne de gauche : les cartes survolées se mettent en évidence. */
  externalDragging?: boolean
  /** Dépôt d'une équipe / personne sur une carte existante (ajout à l'affectation). */
  onDropOnEvent?: (req: DropOnEventRequest) => void
}

function hhmm(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function tint(color: string, pct: number): string {
  return `color-mix(in oklab, ${color} ${pct}%, white)`
}

/** Carte d'affectation FullCalendar sous un point de l'écran (le miroir du glisser est en pointer-events:none). */
function eventElementAt(x: number, y: number): HTMLElement | null {
  for (const el of document.elementsFromPoint(x, y)) {
    const card = (el as HTMLElement).closest?.('.pc-calendar .fc-event[data-affectation-id]') as HTMLElement | null
    if (card) return card
  }
  return null
}

/** Coordonnées écran d'un événement souris ou tactile. */
function pointOf(e: UIEvent | undefined): { x: number; y: number } | null {
  if (!e) return null
  if ('clientX' in e) return { x: (e as MouseEvent).clientX, y: (e as MouseEvent).clientY }
  const t = (e as TouchEvent).changedTouches?.[0]
  return t ? { x: t.clientX, y: t.clientY } : null
}

/** Couleur d'une affectation : celle de son équipe, sinon celle du chantier. */
function eventColor(a: Affectation): string {
  return a.equipe?.color ?? a.chantier.color
}

const PinIcon = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
    <path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11Z" />
    <circle cx="12" cy="10" r="2.5" />
  </svg>
)
const ClockIcon = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" strokeLinecap="round" />
  </svg>
)

/**
 * Calendrier du planning bâti sur FullCalendar (même bibliothèque qu'ela-planning) :
 * sélection d'une plage pour créer, clic pour modifier, glisser-déposer et
 * redimensionnement pour déplacer. Les événements prennent la couleur de leur
 * équipe ; la vue « Par équipe » (timeline) permet de changer d'équipe en
 * changeant de ligne.
 */
const PlanningCalendar = forwardRef<PlanningCalendarHandle, PlanningCalendarProps>(function PlanningCalendar(
  { view, initialDate, affectations, equipes, conflicts, canEdit, onRangeChange, onCreate, onEdit, onMove, externalDragging = false, onDropOnEvent },
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
      ...equipes.map((e, i) => ({ id: String(e.id), title: e.name, extendedProps: { equipe: e, order: i } })),
      // Toujours en dernière ligne (resourceOrder="order").
      { id: UNASSIGNED, title: 'Sans équipe', extendedProps: { equipe: null, order: 9999 } },
    ]
  }, [isTeam, equipes])

  const events = useMemo<EventInput[]>(
    () =>
      affectations.map((a) => {
        const color = eventColor(a)
        const timed = Boolean(a.start_time)
        const hasConflict = a.workers.some((w) => conflicts.has(`${a.date}:${w.id}`))
        return {
          id: String(a.id),
          resourceId: isTeam ? (a.equipe_id ? String(a.equipe_id) : UNASSIGNED) : undefined,
          title: a.chantier.name,
          start: timed && !isTeam ? `${a.date}T${a.start_time}:00` : a.date,
          end: timed && !isTeam && a.end_time ? `${a.date}T${a.end_time}:00` : undefined,
          allDay: !timed || isTeam,
          backgroundColor: tint(color, 16),
          borderColor: color,
          textColor: `color-mix(in oklab, ${color} 62%, black)`,
          classNames: ['pc-event', hasConflict ? 'pc-event--conflict' : ''],
          extendedProps: { affectationId: a.id, color, hasConflict },
        }
      }),
    [affectations, conflicts, isTeam],
  )

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
      const equipeId = arg.resource && arg.resource.id !== UNASSIGNED ? Number(arg.resource.id) : undefined
      if (arg.allDay) {
        onCreate({ date: toKey(arg.start), start_time: null, end_time: null, equipeId })
        return
      }
      const sameDay = toKey(arg.start) === toKey(new Date(arg.end.getTime() - 1))
      onCreate({ date: toKey(arg.start), start_time: hhmm(arg.start), end_time: sameDay ? hhmm(arg.end) : null, equipeId })
    },
    [onCreate],
  )

  // Chaque carte porte l'id de son affectation : permet de savoir sur quelle carte on dépose.
  const handleEventDidMount = useCallback((arg: { el: HTMLElement; event: { extendedProps: Record<string, unknown> } }) => {
    arg.el.dataset.affectationId = String(arg.event.extendedProps.affectationId)
  }, [])

  // Pendant un glisser depuis la colonne de gauche : la carte sous le pointeur
  // se met en évidence (FullCalendar ne gère pas le dépôt sur un événement).
  useEffect(() => {
    if (!externalDragging || !canEdit) return
    let current: HTMLElement | null = null
    const onMove = (e: PointerEvent) => {
      const next = eventElementAt(e.clientX, e.clientY)
      if (next === current) return
      current?.classList.remove('pc-event--drop-target')
      next?.classList.add('pc-event--drop-target')
      current = next
    }
    document.addEventListener('pointermove', onMove, { passive: true })
    return () => {
      document.removeEventListener('pointermove', onMove)
      current?.classList.remove('pc-event--drop-target')
    }
  }, [externalDragging, canEdit])

  // Dépôt d'une équipe ou d'une personne venue de la colonne de gauche (data-fc-drag).
  const handleDrop = useCallback(
    (arg: DropArg) => {
      const raw = arg.draggedEl.getAttribute('data-fc-drag')
      if (!raw) return
      const payload = JSON.parse(raw) as { kind: 'team' | 'person'; id: number }

      // Sur une carte existante : on ajoute à cette affectation au lieu d'en créer une.
      const point = pointOf(arg.jsEvent)
      const targetEl = point ? eventElementAt(point.x, point.y) : null
      const targetId = Number(targetEl?.dataset.affectationId)
      if (targetEl && targetId && onDropOnEvent) {
        targetEl.classList.remove('pc-event--drop-target')
        onDropOnEvent({ affectationId: targetId, kind: payload.kind, id: payload.id })
        return
      }
      const rowEquipe = arg.resource && arg.resource.id !== UNASSIGNED ? Number(arg.resource.id) : undefined
      let start_time: string | null = null
      let end_time: string | null = null
      if (!arg.allDay) {
        start_time = hhmm(arg.date)
        const end = new Date(arg.date.getTime() + 4 * 3600_000)
        end_time = toKey(end) === toKey(arg.date) ? hhmm(end) : '19:00'
      }
      onCreate({
        date: toKey(arg.date),
        start_time,
        end_time,
        equipeId: payload.kind === 'team' ? payload.id : rowEquipe,
        workerIds: payload.kind === 'person' ? [payload.id] : undefined,
      })
    },
    [onCreate, onDropOnEvent],
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

      let equipeChange: MoveRequest['equipeChange']
      if ('newResource' in arg && arg.newResource && arg.oldResource && arg.newResource.id !== arg.oldResource.id) {
        const to = arg.newResource.id === UNASSIGNED ? null : Number(arg.newResource.id)
        const from = arg.oldResource.id === UNASSIGNED ? null : Number(arg.oldResource.id)
        equipeChange = { from, to }
        // Sans worker_ids, l'API remplace les ouvriers par les membres de la nouvelle équipe.
        patch.equipe_id = to
      }

      try {
        await onMove({ id, patch, equipeChange })
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
      const type = arg.view.type
      const address = a ? [a.chantier.address, a.chantier.city].filter(Boolean).join(', ') : ''
      const time = a?.start_time ? `${a.start_time}${a.end_time ? ` – ${a.end_time}` : ''}` : 'Journée'

      if (type.startsWith('list')) {
        return (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="font-semibold text-gray-900">{arg.event.title}</span>
            {address && <span className="text-xs text-gray-500">{address}</span>}
            {a?.equipe && (
              <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium text-white" style={{ backgroundColor: a.equipe.color }}>
                {a.equipe.name}
              </span>
            )}
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

      // Mois et timeline : une ligne compacte.
      if (type === 'dayGridMonth' || type.startsWith('resourceTimeline')) {
        return (
          <div className="pc-event__inner pc-event__inner--compact" title={a ? `${a.chantier.name} · ${time}${a.equipe ? ` · ${a.equipe.name}` : ''}` : undefined}>
            <div className="pc-event__head">
              <span className="pc-event__title">{arg.event.title}</span>
              {conflict && <span className="pc-event__conflict" title="Ouvrier affecté deux fois ce jour">!</span>}
              {a?.start_time && <span className="pc-event__time">{a.start_time}</span>}
            </div>
          </div>
        )
      }

      // Semaine / jour (grille horaire) : titre, adresse, horaire — comme Apple Calendrier.
      return (
        <div className="pc-event__inner" title={a ? `${a.chantier.name}${address ? ` · ${address}` : ''} · ${time}${a.equipe ? ` · ${a.equipe.name}` : ''}` : undefined}>
          <div className="pc-event__head">
            <span className="pc-event__title">{arg.event.title}</span>
            {conflict && <span className="pc-event__conflict" title="Ouvrier affecté deux fois ce jour">!</span>}
          </div>
          {address && (
            <div className="pc-event__meta">
              <PinIcon />
              <span>{address}</span>
            </div>
          )}
          <div className="pc-event__meta">
            <ClockIcon />
            <span>{time}</span>
          </div>
          {a && (a.equipe ? a.workers.length > 1 : a.workers.length > 0) && (
            <div className="pc-event__people">
              <AvatarGroup people={a.workers} max={4} size="xs" />
            </div>
          )}
          {a?.note && <div className="pc-event__note">{a.note}</div>}
        </div>
      )
    },
    [byId],
  )

  const renderResource = useCallback((arg: ResourceLabelContentArg) => {
    const e = arg.resource.extendedProps.equipe as Equipe | null
    if (!e) return <span className="text-sm italic text-gray-500">Sans équipe</span>
    return (
      <span className="flex items-center gap-2">
        <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: e.color }} />
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium text-gray-900">{e.name}</span>
          <span className="block truncate text-[11px] text-gray-500">{e.members.map((m) => m.name.split(' ')[0]).join(', ') || 'Aucun membre'}</span>
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
        slotMinTime="06:00:00"
        slotMaxTime="19:30:00"
        slotDuration="00:30:00"
        snapDuration="00:15:00"
        slotEventOverlap={false}
        slotLabelFormat={{ hour: '2-digit', minute: '2-digit', hour12: false }}
        eventTimeFormat={{ hour: '2-digit', minute: '2-digit', hour12: false }}
        allDaySlot
        allDayText="Journée"
        dayHeaderFormat={{ weekday: 'short', day: 'numeric' }}
        views={{
          dayGridMonth: { dayMaxEvents: 4, dayHeaderFormat: { weekday: 'short' } },
          timeGridWeek: { dayHeaderFormat: { weekday: 'short', day: 'numeric' } },
          timeGridDay: { dayHeaderFormat: { weekday: 'long', day: 'numeric', month: 'long' } },
          resourceTimelineWeek: {
            slotDuration: { days: 1 },
            slotLabelFormat: [{ weekday: 'short', day: 'numeric' }],
            resourceAreaHeaderContent: 'Équipes',
            resourceAreaWidth: '220px',
          },
        }}
        resources={resources}
        resourceOrder="order"
        resourceLabelContent={renderResource}
        events={events}
        eventContent={renderEvent}
        eventDidMount={handleEventDidMount}
        eventOrder="start,title"
        eventMinHeight={26}
        editable={canEdit}
        eventStartEditable={canEdit}
        eventDurationEditable={canEdit && !isTeam}
        eventResourceEditable={canEdit}
        droppable={canEdit}
        dropAccept="[data-fc-drag]"
        drop={handleDrop}
        selectable={canEdit}
        selectMirror
        unselectAuto
        select={handleSelect}
        eventClick={handleEventClick}
        eventDrop={handleChange}
        eventResize={handleChange}
        datesSet={handleDatesSet}
        noEventsText="Aucune affectation sur cette période."
        eventBackgroundColor={tint(NO_TEAM_COLOR, 16)}
      />
    </div>
  )
})

export default PlanningCalendar
