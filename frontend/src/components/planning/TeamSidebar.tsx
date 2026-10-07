import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { DndContext, DragOverlay, PointerSensor, TouchSensor, useDraggable, useDroppable, useSensor, useSensors } from '@dnd-kit/core'
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core'
import { ThirdPartyDraggable } from '@fullcalendar/interaction'
import { useCreateEquipe, useDeleteEquipe, useUpdateEquipe } from '@/hooks/useEquipes'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { getErrorMessage } from '@/lib/errors'
import { toast } from '@/lib/toast'
import type { Equipe, Worker } from '@/types'
import Avatar, { colorFor } from '@/components/ui/Avatar'

/** Clé de la ligne « Sans équipe » dans l'ensemble des équipes masquées. */
export const NO_TEAM = 'none' as const
export type TeamKey = number | typeof NO_TEAM

/** Palette des équipes (couleurs de calendrier, lisibles en fond clair). */
const TEAM_COLORS = ['#ef4444', '#eab308', '#22c55e', '#3b82f6', '#a855f7', '#f97316', '#06b6d4', '#ec4899', '#14b8a6', '#6366f1', '#84cc16', '#78716c']

/** Ce que porte un élément déposable sur le calendrier (lu par FullCalendar via data-fc-drag). */
export type CalendarDragPayload = { kind: 'team'; id: number; title: string } | { kind: 'person'; id: number; title: string }

type DragData = { type: 'person'; worker: Worker } | { type: 'team'; equipe: Equipe }

interface TeamSidebarProps {
  equipes: Equipe[]
  workers: Worker[]
  /** Équipes masquées (les autres sont affichées). */
  hidden: Set<TeamKey>
  onToggle: (key: TeamKey) => void
  onShowAll: () => void
  /** Affiche uniquement cette équipe. */
  onOnly: (key: TeamKey) => void
  /** Nombre d'affectations par équipe sur la période visible. */
  counts: Map<TeamKey, number>
  canManage: boolean
  /** Prévient le calendrier qu'un glisser (équipe / personne) est en cours. */
  onDraggingChange?: (dragging: boolean) => void
}

/**
 * Colonne de gauche du planning : les équipes et leurs membres.
 *
 *  - une case colorée par équipe pour l'afficher ou la masquer (double-clic = seule) ;
 *  - glisser une personne d'une équipe à l'autre, vers « Sans équipe » ou vers
 *    « Nouvelle équipe » recompose les équipes (dnd-kit) ;
 *  - glisser une équipe ou une personne sur le calendrier ouvre la création
 *    d'une affectation sur ce créneau (pont FullCalendar `ThirdPartyDraggable`).
 */
export default function TeamSidebar({ equipes, workers, hidden, onToggle, onShowAll, onOnly, counts, canManage, onDraggingChange }: TeamSidebarProps) {
  const containerRef = useRef<HTMLElement>(null)
  const createEquipe = useCreateEquipe()
  const updateEquipe = useUpdateEquipe()
  const deleteEquipe = useDeleteEquipe()
  const confirm = useConfirm()
  const [active, setActive] = useState<DragData | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
  )

  const unassigned = useMemo(() => workers.filter((w) => !w.equipe_id), [workers])

  // Pont vers FullCalendar : les éléments [data-fc-drag] déposés sur le calendrier
  // déclenchent son callback `drop` (le calendrier n'ajoute rien lui-même : create=false).
  useEffect(() => {
    if (!canManage || !containerRef.current) return
    const draggable = new ThirdPartyDraggable(containerRef.current, {
      itemSelector: '[data-fc-drag]',
      mirrorSelector: '.dnd-mirror',
      eventData: (el) => {
        const payload = JSON.parse(el.getAttribute('data-fc-drag') ?? '{}') as Partial<CalendarDragPayload>
        return { title: payload.title ?? '', duration: '04:00', create: false }
      },
    })
    return () => draggable.destroy()
  }, [canManage])

  /* ------------------------------------------------------ recomposition */

  function saveMembers(equipe: Equipe, memberIds: number[], message: string) {
    updateEquipe.mutate(
      { id: equipe.id, payload: { name: equipe.name, color: equipe.color, sort_order: equipe.sort_order, member_ids: memberIds } },
      { onSuccess: () => toast(message, 'success'), onError: (err) => toast(getErrorMessage(err), 'error') },
    )
  }

  function onDragStart(e: DragStartEvent) {
    setActive((e.active.data.current as DragData | undefined) ?? null)
    onDraggingChange?.(true)
  }

  function onDragEnd(e: DragEndEvent) {
    setActive(null)
    onDraggingChange?.(false)
    const data = e.active.data.current as DragData | undefined
    const overId = e.over?.id
    if (!data || overId === undefined) return

    if (data.type === 'person') {
      const w = data.worker
      const first = w.name.split(' ')[0]
      if (overId === 'new-team') {
        createEquipe.mutate(
          { name: first, color: colorFor(w.name, w.color), member_ids: [w.id] },
          { onSuccess: () => toast(`Équipe « ${first} » créée.`, 'success'), onError: (err) => toast(getErrorMessage(err), 'error') },
        )
        return
      }
      if (overId === 'no-team') {
        const from = equipes.find((eq) => eq.id === w.equipe_id)
        if (from) saveMembers(from, from.members.filter((m) => m.id !== w.id).map((m) => m.id), `${first} retiré(e) de « ${from.name} ».`)
        return
      }
      const targetId = Number(String(overId).replace('team:', ''))
      const target = equipes.find((eq) => eq.id === targetId)
      if (!target || target.id === w.equipe_id) return
      saveMembers(target, [...target.members.map((m) => m.id), w.id], `${first} rejoint « ${target.name} ».`)
      return
    }

    // Une équipe déposée sur une autre : fusion de ses membres dans la cible.
    if (data.type === 'team' && String(overId).startsWith('team:')) {
      const targetId = Number(String(overId).replace('team:', ''))
      const target = equipes.find((eq) => eq.id === targetId)
      if (!target || target.id === data.equipe.id || data.equipe.members.length === 0) return
      saveMembers(target, [...new Set([...target.members.map((m) => m.id), ...data.equipe.members.map((m) => m.id)])], `« ${data.equipe.name} » fusionnée dans « ${target.name} ».`)
    }
  }

  async function removeTeam(equipe: Equipe) {
    const ok = await confirm({
      title: `Supprimer l'équipe « ${equipe.name} » ?`,
      message: 'Ses membres deviennent « sans équipe ». Les affectations déjà planifiées gardent leurs ouvriers.',
      confirmLabel: 'Supprimer',
      danger: true,
    })
    if (!ok) return
    deleteEquipe.mutate(equipe.id, {
      onSuccess: () => toast('Équipe supprimée.', 'success'),
      onError: (err) => toast(getErrorMessage(err, 'Suppression impossible.'), 'error'),
    })
  }

  function addEmptyTeam() {
    const name = window.prompt("Nom de la nouvelle équipe :")?.trim()
    if (!name) return
    createEquipe.mutate(
      { name, color: TEAM_COLORS[equipes.length % TEAM_COLORS.length], member_ids: [] },
      { onSuccess: () => toast(`Équipe « ${name} » créée.`, 'success'), onError: (err) => toast(getErrorMessage(err), 'error') },
    )
  }

  const noTeamCount = counts.get(NO_TEAM) ?? 0

  return (
    <DndContext
      sensors={sensors}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={() => {
        setActive(null)
        onDraggingChange?.(false)
      }}
    >
      <aside ref={containerRef} className="team-sidebar rounded-card border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Équipes</h3>
          <div className="flex items-center gap-2">
            {hidden.size > 0 && (
              <button type="button" onClick={onShowAll} className="text-xs font-medium text-primary hover:underline">
                Tout afficher
              </button>
            )}
            {canManage && (
              <button
                type="button"
                onClick={addEmptyTeam}
                aria-label="Nouvelle équipe"
                title="Nouvelle équipe"
                className="flex h-6 w-6 items-center justify-center rounded-md text-gray-500 transition hover:bg-gray-100 hover:text-gray-900"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M12 5v14M5 12h14" strokeLinecap="round" />
                </svg>
              </button>
            )}
          </div>
        </div>

        <div className="no-scrollbar flex gap-2 overflow-x-auto p-2 lg:block lg:space-y-1.5 lg:overflow-visible">
          {equipes.map((e) => (
            <TeamCard
              key={e.id}
              equipe={e}
              visible={!hidden.has(e.id)}
              count={counts.get(e.id) ?? 0}
              canManage={canManage}
              editing={editingId === e.id}
              onToggle={() => onToggle(e.id)}
              onOnly={() => onOnly(e.id)}
              onEdit={() => setEditingId(editingId === e.id ? null : e.id)}
              onSave={(name, color) => {
                setEditingId(null)
                if (name !== e.name || color !== e.color) saveMembers({ ...e, name, color }, e.members.map((m) => m.id), 'Équipe mise à jour.')
              }}
              onDelete={() => removeTeam(e)}
            />
          ))}

          {canManage && (
            <DropZone id="no-team" className="shrink-0 lg:shrink">
              {(isOver) => (
                <div className={`rounded-lg border border-dashed px-2 py-1.5 transition ${isOver ? 'border-primary bg-primary-soft' : 'border-gray-200'}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-gray-500">Sans équipe</span>
                    {noTeamCount > 0 && (
                      <button
                        type="button"
                        onClick={() => onToggle(NO_TEAM)}
                        className={`text-[11px] tabular-nums ${hidden.has(NO_TEAM) ? 'text-gray-300 line-through' : 'text-gray-400'}`}
                        title="Afficher / masquer les affectations sans équipe"
                      >
                        {noTeamCount} affect.
                      </button>
                    )}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {unassigned.length === 0 ? (
                      <span className="text-[11px] italic text-gray-400">Dépose ici pour retirer d'une équipe</span>
                    ) : (
                      unassigned.map((w) => <PersonChip key={w.id} worker={w} draggable />)
                    )}
                  </div>
                </div>
              )}
            </DropZone>
          )}

          {canManage && (
            <DropZone id="new-team" className="shrink-0 lg:shrink">
              {(isOver) => (
                <div
                  className={`flex items-center justify-center gap-1.5 rounded-lg border border-dashed px-2 py-2 text-xs font-medium transition ${
                    isOver ? 'border-primary bg-primary-soft text-primary' : 'border-gray-200 text-gray-400'
                  }`}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M12 5v14M5 12h14" strokeLinecap="round" />
                  </svg>
                  Dépose une personne : nouvelle équipe
                </div>
              )}
            </DropZone>
          )}
        </div>

        {canManage && (
          <div className="border-t border-gray-100 px-4 py-2.5 text-[11px] leading-snug text-gray-400">
            Glisse une <strong className="font-medium text-gray-500">équipe</strong> ou une <strong className="font-medium text-gray-500">personne</strong> sur le
            calendrier pour l'affecter à un chantier.{' '}
            <Link to="/equipes" className="font-medium text-primary hover:underline">
              Gérer les équipes
            </Link>
          </div>
        )}
      </aside>

      {/* Miroir du glisser (aussi lu par FullCalendar via mirrorSelector). */}
      <DragOverlay dropAnimation={null}>
        {active?.type === 'person' && (
          <div className="dnd-mirror">
            <PersonChip worker={active.worker} />
          </div>
        )}
        {active?.type === 'team' && (
          <div className="dnd-mirror">
            <TeamPill equipe={active.equipe} />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  )
}

/* ------------------------------------------------------------------ pièces */

function DropZone({ id, className = '', children }: { id: string; className?: string; children: (isOver: boolean) => ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id })
  return (
    <div ref={setNodeRef} className={className}>
      {children(isOver)}
    </div>
  )
}

/** Pastille d'un membre : glissable entre équipes et vers le calendrier. */
function PersonChip({ worker, draggable = false }: { worker: Worker; draggable?: boolean }) {
  const { setNodeRef, listeners, attributes, isDragging } = useDraggable({
    id: `person:${worker.id}`,
    data: { type: 'person', worker } satisfies DragData,
    disabled: !draggable,
  })
  const first = worker.name.split(' ')[0]
  const payload: CalendarDragPayload = { kind: 'person', id: worker.id, title: first }
  return (
    <span
      ref={setNodeRef}
      {...(draggable ? listeners : {})}
      {...(draggable ? attributes : {})}
      data-fc-drag={draggable ? JSON.stringify(payload) : undefined}
      title={draggable ? `${worker.name} — glisse vers une équipe ou sur le calendrier` : worker.name}
      className={`person-chip inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white py-0.5 pl-0.5 pr-2 text-xs font-medium text-gray-800 shadow-sm ${
        draggable ? 'cursor-grab select-none active:cursor-grabbing' : ''
      } ${isDragging ? 'opacity-40' : ''}`}
    >
      <Avatar name={worker.name} color={worker.color} size="xs" />
      {first}
    </span>
  )
}

/** Vignette d'une équipe (miroir de glisser). */
function TeamPill({ equipe }: { equipe: Equipe }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-sm font-medium text-gray-900 shadow-lg">
      <span className="h-3 w-3 rounded-full" style={{ backgroundColor: equipe.color }} />
      {equipe.name}
      <span className="text-xs text-gray-500">{equipe.members.map((m) => m.name.split(' ')[0]).join(', ')}</span>
    </span>
  )
}

interface TeamCardProps {
  equipe: Equipe
  visible: boolean
  count: number
  canManage: boolean
  editing: boolean
  onToggle: () => void
  onOnly: () => void
  onEdit: () => void
  onSave: (name: string, color: string) => void
  onDelete: () => void
}

/** Carte d'une équipe : case de visibilité, poignée glissable vers le calendrier, membres, zone de dépôt. */
function TeamCard({ equipe, visible, count, canManage, editing, onToggle, onOnly, onEdit, onSave, onDelete }: TeamCardProps) {
  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: `team:${equipe.id}`, disabled: !canManage })
  const {
    setNodeRef: setDragRef,
    listeners,
    attributes,
    isDragging,
  } = useDraggable({ id: `team-drag:${equipe.id}`, data: { type: 'team', equipe } satisfies DragData, disabled: !canManage })
  const payload: CalendarDragPayload = { kind: 'team', id: equipe.id, title: equipe.name }
  const style = { '--team': equipe.color } as CSSProperties

  return (
    <div
      ref={setDropRef}
      style={style}
      className={`team-card w-56 shrink-0 rounded-lg border px-2 py-1.5 transition lg:w-auto ${isOver ? 'is-over' : 'border-gray-200'} ${visible ? '' : 'opacity-60'} ${
        isDragging ? 'opacity-40' : ''
      }`}
    >
      <div className="flex items-center gap-2">
        <label className="flex cursor-pointer items-center" title="Afficher / masquer dans le calendrier (double-clic : seule)" onDoubleClick={onOnly}>
          <input type="checkbox" checked={visible} onChange={onToggle} className="sr-only" aria-label={`Afficher ${equipe.name}`} />
          <span
            className="flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-[5px] text-white"
            style={{ backgroundColor: visible ? equipe.color : 'transparent', boxShadow: `inset 0 0 0 2px ${equipe.color}` }}
            aria-hidden
          >
            {visible && (
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5">
                <path d="m5 12 5 5L20 7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </span>
        </label>

        {editing ? (
          <TeamEditForm equipe={equipe} onSave={onSave} onDelete={onDelete} />
        ) : (
          <span
            ref={setDragRef}
            {...(canManage ? listeners : {})}
            {...(canManage ? attributes : {})}
            data-fc-drag={canManage ? JSON.stringify(payload) : undefined}
            title={canManage ? 'Glisse cette équipe sur le calendrier pour l’affecter à un chantier' : equipe.name}
            className={`flex min-w-0 flex-1 items-center gap-1.5 rounded px-1 py-0.5 text-sm font-medium text-gray-900 ${
              canManage ? 'cursor-grab select-none hover:bg-gray-50 active:cursor-grabbing' : ''
            }`}
          >
            {canManage && (
              <svg width="10" height="14" viewBox="0 0 10 16" className="shrink-0 text-gray-300" fill="currentColor" aria-hidden>
                <circle cx="3" cy="3" r="1.4" />
                <circle cx="7" cy="3" r="1.4" />
                <circle cx="3" cy="8" r="1.4" />
                <circle cx="7" cy="8" r="1.4" />
                <circle cx="3" cy="13" r="1.4" />
                <circle cx="7" cy="13" r="1.4" />
              </svg>
            )}
            <span className="truncate">{equipe.name}</span>
            {equipe.expires_at && (
              <span className="shrink-0 rounded bg-amber-50 px-1 text-[10px] font-medium text-amber-700" title={`Équipe temporaire jusqu'au ${equipe.expires_at}`}>
                temp.
              </span>
            )}
          </span>
        )}

        <span className="ml-auto flex shrink-0 items-center gap-1">
          {count > 0 && <span className="text-[11px] tabular-nums text-gray-400">{count}</span>}
          {canManage && (
            <button
              type="button"
              onClick={onEdit}
              aria-label="Renommer ou recolorer"
              title="Renommer / couleur / supprimer"
              className={`flex h-5 w-5 items-center justify-center rounded text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 ${editing ? 'bg-gray-100 text-gray-700' : ''}`}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          )}
        </span>
      </div>

      <div className="mt-1 flex min-h-6 flex-wrap gap-1 pl-6">
        {equipe.members.length === 0 ? (
          <span className="text-[11px] italic text-gray-400">{canManage ? 'Dépose une personne ici' : 'Aucun membre'}</span>
        ) : (
          equipe.members.map((m) => <PersonChip key={m.id} worker={m} draggable={canManage} />)
        )}
      </div>
    </div>
  )
}

/** Renommage / couleur / suppression d'une équipe (monté seulement en édition : état frais). */
function TeamEditForm({ equipe, onSave, onDelete }: { equipe: Equipe; onSave: (name: string, color: string) => void; onDelete: () => void }) {
  const [name, setName] = useState(equipe.name)
  const [color, setColor] = useState(equipe.color)
  return (
    <form
      className="flex min-w-0 flex-1 flex-col gap-1.5"
      onSubmit={(e) => {
        e.preventDefault()
        if (name.trim()) onSave(name.trim(), color)
      }}
    >
      <div className="flex items-center gap-1">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
          className="w-full min-w-0 rounded border border-gray-300 px-1.5 py-0.5 text-sm outline-none focus:border-primary"
          aria-label="Nom de l'équipe"
        />
        <button type="submit" className="rounded px-1.5 py-0.5 text-xs font-medium text-primary hover:bg-primary-soft">
          OK
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-1">
        {TEAM_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setColor(c)}
            aria-label={`Couleur ${c}`}
            className={`h-4 w-4 rounded-full transition ${color === c ? 'ring-2 ring-gray-900 ring-offset-1' : 'hover:scale-110'}`}
            style={{ backgroundColor: c }}
          />
        ))}
        <button type="button" onClick={onDelete} className="ml-auto text-[11px] font-medium text-red-600 hover:underline">
          Supprimer
        </button>
      </div>
    </form>
  )
}
