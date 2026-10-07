import { Link } from 'react-router-dom'
import type { Chantier } from '@/types'

interface ChantierSidebarProps {
  chantiers: Chantier[]
  /** Chantiers masqués (les autres sont affichés). */
  hidden: Set<number>
  onToggle: (id: number) => void
  onOnly: (id: number) => void
  onShowAll: () => void
  /** Nombre d'affectations par chantier sur la période visible. */
  counts: Map<number, number>
  canManage: boolean
}

/**
 * Colonne de gauche : un « calendrier » par chantier, à la manière d'Apple
 * Calendrier. Chaque chantier a sa couleur et une case pour l'afficher ou le
 * masquer dans le calendrier (double-clic : seulement celui-là).
 */
export default function ChantierSidebar({ chantiers, hidden, onToggle, onOnly, onShowAll, counts, canManage }: ChantierSidebarProps) {
  return (
    <aside className="rounded-card border border-gray-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Chantiers</h3>
        {hidden.size > 0 && (
          <button type="button" onClick={onShowAll} className="text-xs font-medium text-primary hover:underline">
            Tout afficher
          </button>
        )}
      </div>

      <ul className="no-scrollbar flex gap-1 overflow-x-auto p-2 lg:block lg:space-y-0.5 lg:overflow-visible">
        {chantiers.length === 0 && <li className="px-2 py-1 text-xs italic text-gray-400">Aucun chantier ouvert.</li>}
        {chantiers.map((c) => {
          const visible = !hidden.has(c.id)
          const count = counts.get(c.id) ?? 0
          return (
            <li key={c.id} className="shrink-0 lg:shrink">
              <label
                className={`flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 transition hover:bg-gray-50 ${visible ? '' : 'opacity-50'}`}
                onDoubleClick={() => onOnly(c.id)}
                title="Double-clic : afficher seulement ce chantier"
              >
                <input type="checkbox" checked={visible} onChange={() => onToggle(c.id)} className="sr-only" aria-label={`Afficher ${c.name}`} />
                <span
                  className="flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-[5px] text-white"
                  style={{ backgroundColor: visible ? c.color : 'transparent', boxShadow: `inset 0 0 0 2px ${c.color}` }}
                  aria-hidden
                >
                  {visible && (
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5">
                      <path d="m5 12 5 5L20 7" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-gray-900">{c.name}</span>
                  {(c.city || c.address) && <span className="hidden truncate text-[11px] text-gray-500 lg:block">{[c.address, c.city].filter(Boolean).join(', ')}</span>}
                </span>
                {count > 0 && <span className="shrink-0 text-[11px] tabular-nums text-gray-400">{count}</span>}
              </label>
            </li>
          )
        })}
      </ul>

      {canManage && (
        <div className="border-t border-gray-100 px-4 py-2.5">
          <Link to="/chantiers" className="text-xs font-medium text-primary hover:underline">
            Gérer les chantiers
          </Link>
        </div>
      )}
    </aside>
  )
}
