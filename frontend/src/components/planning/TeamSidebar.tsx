import { Link } from 'react-router-dom'
import type { Equipe } from '@/types'
import { AvatarGroup } from '@/components/ui/Avatar'

/** Clé de la ligne « Sans équipe » dans l'ensemble des équipes masquées. */
export const NO_TEAM = 'none' as const
export type TeamKey = number | typeof NO_TEAM

interface TeamSidebarProps {
  equipes: Equipe[]
  /** Équipes masquées (les autres sont affichées). */
  hidden: Set<TeamKey>
  onToggle: (key: TeamKey) => void
  onShowAll: () => void
  /** Affiche uniquement cette équipe. */
  onOnly: (key: TeamKey) => void
  /** Nombre d'affectations par équipe sur la période visible. */
  counts: Map<TeamKey, number>
  canManage: boolean
}

/**
 * Colonne de gauche du planning, à la manière des calendriers d'Apple : une
 * ligne par équipe avec sa couleur, ses membres et une case pour l'afficher
 * ou la masquer dans le calendrier.
 */
export default function TeamSidebar({ equipes, hidden, onToggle, onShowAll, onOnly, counts, canManage }: TeamSidebarProps) {
  const rows: { key: TeamKey; name: string; color: string; members: Equipe['members'] }[] = [
    ...equipes.map((e) => ({ key: e.id as TeamKey, name: e.name, color: e.color, members: e.members })),
    { key: NO_TEAM, name: 'Sans équipe', color: '#9ca3af', members: [] },
  ]

  return (
    <aside className="rounded-card border border-gray-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Équipes</h3>
        {hidden.size > 0 && (
          <button type="button" onClick={onShowAll} className="text-xs font-medium text-primary hover:underline">
            Tout afficher
          </button>
        )}
      </div>

      <ul className="no-scrollbar flex gap-1 overflow-x-auto p-2 lg:block lg:space-y-0.5 lg:overflow-visible">
        {rows.map((row) => {
          const visible = !hidden.has(row.key)
          const count = counts.get(row.key) ?? 0
          if (row.key === NO_TEAM && count === 0) return null
          return (
            <li key={row.key} className="group shrink-0 lg:shrink">
              <div
                className={`flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition hover:bg-gray-50 ${visible ? '' : 'opacity-50'}`}
                onDoubleClick={() => onOnly(row.key)}
                title="Double-clic : afficher seulement cette équipe"
              >
                <label className="flex cursor-pointer items-center gap-2.5">
                  <input type="checkbox" checked={visible} onChange={() => onToggle(row.key)} className="sr-only" aria-label={`Afficher ${row.name}`} />
                  <span
                    className="flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-[5px] text-white transition"
                    style={{ backgroundColor: visible ? row.color : 'transparent', boxShadow: `inset 0 0 0 2px ${row.color}` }}
                    aria-hidden
                  >
                    {visible && (
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5">
                        <path d="m5 12 5 5L20 7" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </span>
                  <span className="min-w-0">
                    <span className={`block truncate text-sm font-medium ${row.key === NO_TEAM ? 'italic text-gray-500' : 'text-gray-900'}`}>{row.name}</span>
                    {row.members.length > 0 && (
                      <span className="hidden truncate text-[11px] text-gray-500 lg:block">
                        {row.members.length === 1 ? row.members[0].job_title ?? row.members[0].name : row.members.map((m) => m.name.split(' ')[0]).join(', ')}
                      </span>
                    )}
                  </span>
                </label>
                <span className="ml-auto flex shrink-0 items-center gap-2">
                  {row.members.length > 1 && <AvatarGroup people={row.members} max={3} size="xs" />}
                  {count > 0 && <span className="text-[11px] tabular-nums text-gray-400">{count}</span>}
                </span>
              </div>
            </li>
          )
        })}
      </ul>

      {canManage && (
        <div className="border-t border-gray-100 px-4 py-2.5">
          <Link to="/equipes" className="text-xs font-medium text-primary hover:underline">
            Gérer les équipes
          </Link>
        </div>
      )}
    </aside>
  )
}
