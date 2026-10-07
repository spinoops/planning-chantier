import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef } from 'react'
import FullCalendar from '@fullcalendar/react'
import type { DateSelectArg, DatesSetArg, EventClickArg, EventContentArg, EventDropArg, EventInput } from '@fullcalendar/core'
import frLocale from '@fullcalendar/core/locales/fr'
import dayGridPlugin from '@fullcalendar/daygrid'
import interactionPlugin from '@fullcalendar/interaction'
import type { DropArg, EventResizeDoneArg } from '@fullcalendar/interaction'
import resourcePlugin from '@fullcalendar/resource'
import type { ResourceLabelContentArg } from '@fullcalendar/resource'
import resourceTimelinePlugin from '@fullcalendar/resource-timeline'
import timeGridPlugin from '@fullcalendar/timegrid'
import { toKey } from '@/lib/dates'
import type { Absence, Affectation, AffectationPayload, Worker } from '@/types'
import Avatar, { colorFor } from '@/components/ui/Avatar'
import type { CalendarView } from '@/components/planning/CalendarToolbar'

/**
 * Vues FullCalendar derrière chaque vue de la barre d'outils.
 * Un calendrier par chantier (couleur du chantier), les personnes affectées
 * dans chaque carte ; « Par employé » est une timeline : une ligne par personne,
 * ses chantiers de la semaine dessus (changer de ligne = réaffecter la personne).
 */
const FC_VIEWS: Record<CalendarView, string> = {
  month: 'dayGridMonth',
  week: 'timeGridWeek',
  day: 'timeGridDay',
  staff: 'resourceTimelineWeek',
}

/** Ligne virtuelle de la vue « Par employé » pour les affectations sans personne. */
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
  /** Ligne d'équipe cliquée (vue Par équipe), ou équipe déposée depuis la colonne de gauche. */
  equipeId?: number
  /** Ligne de chantier cliquée (vue Par chantier). */
  chantierId?: number
  /** Personne déposée depuis la colonne de gauche (affectation individuelle). */
  workerIds?: number[]
}

/** Ce qu'un glisser-déposer / redimensionnement demande à l'API. */
export interface MoveRequest {
  id: number
  patch: Partial<AffectationPayload>
  /** Vue « Par employé » : changement de ligne (null = ligne « Personne affectée »). */
  workerChange?: { from: number | null; to: number | null }
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
  /** Personnes affectables (lignes de la vue « Par employé »). */
  workers: Worker[]
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
  /** Absences de la période : affichées en fond (vue Semaine / Jour) et sur la ligne de l'équipe (vue Par équipe). */
  absences?: Absence[]
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

function firstName(name: string): string {
  return name.split(' ')[0]
}

/**
 * Calendrier du planning bâti sur FullCalendar (même bibliothèque qu'ela-planning) :
 * un calendrier par chantier (couleur du chantier) avec les personnes affectées
 * dans chaque carte ; sélection d'une plage pour créer, clic pour modifier,
 * glisser-déposer et redimensionnement pour déplacer. Les timelines « Par
 * équipe » et « Par chantier » permettent de changer d'équipe ou de chantier
 * en changeant de ligne.
 */
const PlanningCalendar = forwardRef<PlanningCalendarHandle, PlanningCalendarProps>(function PlanningCalendar(
  { view, initialDate, affectations, workers, conflicts, canEdit, onRangeChange, onCreate, onEdit, onMove, externalDragging = false, onDropOnEvent, absences = [] },
  ref,
) {
  const calRef = useRef<FullCalendar>(null)
  const api = () => calRef.current?.getApi()
  const byId = useMemo(() => new Map(affectations.map((a) => [a.id, a])), [affectations])
  const byStaff = view === 'staff'
  const isTimeline = byStaff

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
    if (!byStaff) return undefined
    return [
      ...workers.map((w, i) => ({ id: String(w.id), title: w.name, extendedProps: { worker: w, order: i } })),
      // Toujours en dernière ligne (resourceOrder="order").
      { id: UNASSIGNED, title: 'Personne affectée', extendedProps: { worker: null, order: 9999 } },
    ]
  }, [byStaff, workers])

  const events = useMemo<EventInput[]>(() => {
    // Absences en fond : colonne du jour grisée avec le prénom (Semaine / Jour) ou ligne de la personne (Par employé).
    const absenceEvents: EventInput[] = absences.map((ab) => {
      const end = new Date(ab.end_date)
      end.setDate(end.getDate() + 1) // `end` exclusif
      return {
        id: `absence:${ab.id}`,
        start: ab.start_date,
        end: toKey(end),
        allDay: true,
        display: 'background',
        resourceId: byStaff ? String(ab.user_id) : undefined,
        backgroundColor: 'rgba(107, 114, 128, 0.14)',
        classNames: ['pc-absence'],
        title: `${firstName(ab.user?.name ?? '')} absent(e) · ${ab.type_label}`,
        extendedProps: { absence: true, label: `${firstName(ab.user?.name ?? '')} · ${ab.type_label}` },
        editable: false,
      }
    })

    const base = (a: Affectation): EventInput => {
      const color = a.chantier.color
      const timed = Boolean(a.start_time)
      const hasConflict = a.workers.some((w) => conflicts.has(`${a.date}:${w.id}`))
      return {
        id: String(a.id),
        title: a.chantier.name,
        start: timed && !isTimeline ? `${a.date}T${a.start_time}:00` : a.date,
        end: timed && !isTimeline && a.end_time ? `${a.date}T${a.end_time}:00` : undefined,
        allDay: !timed || isTimeline,
        backgroundColor: tint(color, 24),
        borderColor: 'transparent',
        textColor: `color-mix(in oklab, ${color} 62%, black)`,
        classNames: ['pc-event', hasConflict ? 'pc-event--conflict' : ''],
        extendedProps: { affectationId: a.id, color, hasConflict },
      }
    }

    const list: EventInput[] = byStaff
      ? affectations.flatMap((a) => {
          const ev = base(a)
          const rows: EventInput[] = [
            ...a.workers.map((w) => ({ ...ev, id: `${a.id}:${w.id}`, resourceId: String(w.id), extendedProps: { ...ev.extendedProps, workerId: w.id } })),
            ...a.visitors.map((v) => ({
              ...ev,
              id: `${a.id}:visit:${v.id}`,
              resourceId: String(v.id),
              classNames: [...(ev.classNames as string[]), 'pc-event--visit'],
              extendedProps: { ...ev.extendedProps, workerId: v.id, visit: true },
            })),
          ]
          return rows.length > 0 ? rows : [{ ...ev, id: `${a.id}:none`, resourceId: UNASSIGNED }]
        })
      : affectations.map(base)

    return [...absenceEvents, ...list]
  }, [affectations, conflicts, isTimeline, byStaff, absences])

  /* ------------------------------------------------------------ interactions */

  const handleDatesSet = useCallback(
    (arg: DatesSetArg) => {
      const last = new Date(arg.end)
      last.setDate(last.getDate() - 1) // `end` est exclusif
      onRangeChange({ from: toKey(arg.start), to: toKey(last), title: arg.view.title, current: arg.view.currentStart })
    },
    [onRangeChange],
  )

  /** Personne de la ligne cliquée ou survolée (vue « Par employé »). */
  const rowContext = useCallback(
    (resourceId: string | undefined): { workerIds?: number[] } => {
      if (!resourceId || !byStaff || resourceId === UNASSIGNED) return {}
      return { workerIds: [Number(resourceId)] }
    },
    [byStaff],
  )

  const handleSelect = useCallback(
    (arg: DateSelectArg) => {
      api()?.unselect()
      const ctx = rowContext(arg.resource?.id)
      if (arg.allDay) {
        onCreate({ date: toKey(arg.start), start_time: null, end_time: null, ...ctx })
        return
      }
      const sameDay = toKey(arg.start) === toKey(new Date(arg.end.getTime() - 1))
      onCreate({ date: toKey(arg.start), start_time: hhmm(arg.start), end_time: sameDay ? hhmm(arg.end) : null, ...ctx })
    },
    [onCreate, rowContext],
  )

  // Chaque carte porte l'id de son affectation : permet de savoir sur quelle carte on dépose.
  const handleEventDidMount = useCallback((arg: { el: HTMLElement; event: { extendedProps: Record<string, unknown> } }) => {
    if (arg.event.extendedProps.affectationId) arg.el.dataset.affectationId = String(arg.event.extendedProps.affectationId)
  }, [])

  // Pendant un glisser depuis la colonne de gauche : la carte sous le pointeur se met en évidence.
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

      const ctx = rowContext(arg.resource?.id)
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
        equipeId: payload.kind === 'team' ? payload.id : undefined,
        workerIds: payload.kind === 'person' ? [...new Set([payload.id, ...(ctx.workerIds ?? [])])] : ctx.workerIds,
      })
    },
    [onCreate, onDropOnEvent, rowContext],
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
      if (!isTimeline) {
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
      if (byStaff && 'newResource' in arg && arg.newResource && arg.oldResource && arg.newResource.id !== arg.oldResource.id) {
        // Un « passage » (patron / chef) ne se déplace pas d'une personne à l'autre.
        if (ev.extendedProps.visit) return arg.revert()
        const from = arg.oldResource.id === UNASSIGNED ? null : Number(arg.oldResource.id)
        const to = arg.newResource.id === UNASSIGNED ? null : Number(arg.newResource.id)
        const ids = a.workers.map((w) => w.id).filter((wid) => wid !== from)
        if (to && !ids.includes(to)) ids.push(to)
        patch.worker_ids = ids
        workerChange = { from, to }
      }

      try {
        await onMove({ id, patch, workerChange })
      } catch {
        arg.revert()
      }
    },
    [byId, isTimeline, byStaff, onMove],
  )

  /* ---------------------------------------------------------------- rendu */

  const renderEvent = useCallback(
    (arg: EventContentArg) => {
      if (arg.event.extendedProps.absence) {
        return <div className="pc-absence__label">{String(arg.event.extendedProps.label)}</div>
      }
      const a = byId.get(Number(arg.event.extendedProps.affectationId))
      const conflict = Boolean(arg.event.extendedProps.hasConflict)
      const type = arg.view.type
      const address = a ? [a.chantier.address, a.chantier.city].filter(Boolean).join(', ') : ''
      const time = a?.start_time ? `${a.start_time}${a.end_time ? ` – ${a.end_time}` : ''}` : 'Journée'
      const people = a?.workers ?? []
      const peopleLabel = people.map((w) => firstName(w.name)).join(', ')

      // Mois : une ligne compacte avec les prénoms.
      if (type === 'dayGridMonth') {
        return (
          <div className="pc-event__inner pc-event__inner--compact" title={a ? `${a.chantier.name} · ${time} · ${peopleLabel || 'personne'}` : undefined}>
            <div className="pc-event__head">
              <span className="pc-event__title">{arg.event.title}</span>
              {conflict && <span className="pc-event__conflict" title="Ouvrier affecté deux fois ce jour">!</span>}
              {people.length > 0 && <span className="pc-event__time">{peopleLabel}</span>}
            </div>
          </div>
        )
      }

      // Par employé : chantier + horaire sur la ligne de la personne (passage en pointillé).
      if (type.startsWith('resourceTimeline')) {
        const visit = Boolean(arg.event.extendedProps.visit)
        const others = people.filter((w) => w.id !== Number(arg.event.extendedProps.workerId))
        return (
          <div className="pc-event__inner pc-event__inner--compact" title={a ? `${a.chantier.name}${address ? ` · ${address}` : ''} · ${time} · ${peopleLabel || 'personne'}` : undefined}>
            <div className="pc-event__head">
              <span className="pc-event__title">{arg.event.title}</span>
              {visit && <span className="pc-event__time">passage</span>}
              {conflict && !visit && <span className="pc-event__conflict" title="Personne affectée deux fois ce jour">!</span>}
              {a?.start_time && <span className="pc-event__time">{time}</span>}
            </div>
            {others.length > 0 && <div className="pc-event__meta pc-event__meta--muted">avec {others.map((w) => firstName(w.name)).join(', ')}</div>}
          </div>
        )
      }

      // Semaine / jour (grille horaire) : chantier, personnes, adresse, horaire.
      return (
        <div className="pc-event__inner" title={a ? `${a.chantier.name}${address ? ` · ${address}` : ''} · ${time} · ${peopleLabel || 'personne'}` : undefined}>
          <div className="pc-event__head">
            <span className="pc-event__title">{arg.event.title}</span>
            {conflict && <span className="pc-event__conflict" title="Ouvrier affecté deux fois ce jour">!</span>}
          </div>
          {a && (
            <div className="pc-event__people">
              {people.length === 0 ? (
                <span className="italic opacity-60">Personne</span>
              ) : (
                people.slice(0, 6).map((w) => (
                  <span key={w.id} className="pc-event__person">
                    <span className="pc-event__avatar" style={{ backgroundColor: colorFor(w.name, w.color) }}>
                      {w.name
                        .split(/\s+/)
                        .slice(0, 2)
                        .map((p) => p[0]?.toUpperCase())
                        .join('')}
                    </span>
                    <span className="pc-event__person-name">{firstName(w.name)}</span>
                  </span>
                ))
              )}
              {people.length > 6 && <span className="pc-event__more">+{people.length - 6}</span>}
            </div>
          )}
          {address && (
            <div className="pc-event__meta">
              <PinIcon />
              <span>{address}</span>
            </div>
          )}
          <div className="pc-event__meta">
            <ClockIcon />
            <span>
              {time}
              {a?.phase ? ` · ${a.phase}` : ''}
            </span>
          </div>
          {a && a.visitors.length > 0 && (
            <div className="pc-event__meta" title={`Passage : ${a.visitors.map((v) => v.name).join(', ')}`}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
                <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
              <span>Passage {a.visitors.map((v) => firstName(v.name)).join(', ')}</span>
            </div>
          )}
          {a?.note && <div className="pc-event__note">{a.note}</div>}
        </div>
      )
    },
    [byId],
  )

  const renderResource = useCallback((arg: ResourceLabelContentArg) => {
    const w = arg.resource.extendedProps.worker as Worker | null | undefined
    if (!w) return <span className="text-sm italic text-gray-500">Personne affectée</span>
    return (
      <span className="flex items-center gap-2.5">
        <Avatar name={w.name} color={w.color} size="md" />
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium text-gray-900">{w.name}</span>
          <span className="block truncate text-[11px] text-gray-500">{w.job_title || '—'}</span>
        </span>
      </span>
    )
  }, [])

  return (
    <div className="pc-calendar overflow-hidden glass-panel rounded-card">
      <FullCalendar
        ref={calRef}
        plugins={[interactionPlugin, dayGridPlugin, timeGridPlugin, resourcePlugin, resourceTimelinePlugin]}
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
            resourceAreaHeaderContent: 'Employés',
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
        eventDurationEditable={canEdit && !isTimeline}
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
