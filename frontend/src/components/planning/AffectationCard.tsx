import type { CSSProperties, DragEvent } from 'react'
import { formatTimeRange } from '@/lib/dates'
import type { Affectation } from '@/types'
import Avatar, { AvatarGroup } from '@/components/ui/Avatar'

interface AffectationCardProps {
  affectation: Affectation
  /** compact = pastille du mois · card = carte de la semaine · detail = carte de l'agenda. */
  variant?: 'compact' | 'card' | 'detail'
  onClick?: () => void
  /** Glisser-déposer entre jours (planificateurs). */
  draggable?: boolean
  onDragStart?: (e: DragEvent<HTMLElement>) => void
  onDragEnd?: () => void
  dragging?: boolean
  /** Clés « date:workerId » des ouvriers affectés deux fois le même jour. */
  conflicts?: Set<string>
  className?: string
}

/** Carte d'une affectation, teintée par la couleur de son chantier. */
export default function AffectationCard({
  affectation,
  variant = 'card',
  onClick,
  draggable = false,
  onDragStart,
  onDragEnd,
  dragging = false,
  conflicts,
  className = '',
}: AffectationCardProps) {
  const { chantier, workers, start_time, end_time, note, date } = affectation
  const style = { '--chantier': chantier.color } as CSSProperties
  const conflictWorkers = conflicts ? workers.filter((w) => conflicts.has(`${date}:${w.id}`)) : []
  const hasConflict = conflictWorkers.length > 0
  const conflictTitle = hasConflict ? `Déjà affecté(s) ce jour : ${conflictWorkers.map((w) => w.name).join(', ')}` : undefined
  const interactive = onClick ? 'cursor-pointer' : ''
  const dragClass = dragging ? 'is-dragging' : ''
  const Tag = onClick ? 'button' : 'div'

  if (variant === 'compact') {
    return (
      <Tag
        type={onClick ? 'button' : undefined}
        onClick={onClick}
        draggable={draggable}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        style={style}
        title={`${chantier.name} · ${formatTimeRange(start_time, end_time)} · ${workers.length} pers.`}
        className={`chantier-card flex w-full items-center gap-1.5 rounded-md border px-1.5 py-1 text-left text-[11px] font-medium leading-tight transition ${interactive} ${dragClass} ${className}`}
      >
        <span className="chantier-dot h-2 w-2 shrink-0 rounded-full" aria-hidden />
        <span className="min-w-0 flex-1 truncate">{chantier.name}</span>
        {hasConflict && <span className="text-amber-600" title={conflictTitle}>!</span>}
        <span className="shrink-0 tabular-nums opacity-70">{workers.length}</span>
      </Tag>
    )
  }

  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      style={style}
      className={`chantier-card group relative block w-full rounded-lg border p-2.5 text-left transition ${interactive} ${dragClass} ${className}`}
    >
      <div className="flex items-start gap-2">
        <span className="chantier-dot mt-1 h-2.5 w-2.5 shrink-0 rounded-full" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold leading-snug">{chantier.name}</p>
          <p className="text-xs opacity-80">
            {formatTimeRange(start_time, end_time)}
            {variant === 'detail' && chantier.city && <span className="opacity-80"> · {chantier.city}</span>}
          </p>
        </div>
        {hasConflict && (
          <span
            title={conflictTitle}
            className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-100 text-[11px] font-bold text-amber-700"
          >
            !
          </span>
        )}
      </div>

      {variant === 'card' && (
        <div className="mt-2 flex items-center justify-between gap-2">
          {workers.length > 0 ? <AvatarGroup people={workers} max={5} size="sm" /> : <span className="text-xs italic opacity-60">Personne</span>}
          {note && <span className="truncate text-[11px] italic opacity-70">{note}</span>}
        </div>
      )}

      {variant === 'detail' && (
        <>
          {workers.length > 0 ? (
            <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
              {workers.map((w) => (
                <li key={w.id} className="flex items-center gap-1.5 text-xs">
                  <Avatar name={w.name} color={w.color} size="xs" />
                  <span className={conflicts?.has(`${date}:${w.id}`) ? 'font-semibold text-amber-700' : ''}>{w.name}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-xs italic opacity-60">Aucun ouvrier affecté.</p>
          )}
          {note && <p className="mt-2 text-xs italic opacity-80">{note}</p>}
        </>
      )}
    </Tag>
  )
}
