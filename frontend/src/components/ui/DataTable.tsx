import type { ReactNode } from 'react'
import Spinner from '@/components/ui/Spinner'
import EmptyState from '@/components/ui/EmptyState'

export interface Column<T> {
  /** Clé de tri envoyée à l'API (?sort=) et identifiant de colonne. */
  key: string
  header: ReactNode
  render: (row: T) => ReactNode
  sortable?: boolean
  /** Classes de la cellule (alignement, largeur…). */
  className?: string
}

interface DataTableProps<T> {
  columns: Column<T>[]
  rows: T[]
  rowKey: (row: T) => string | number
  loading?: boolean
  /** Rafraîchissement en cours (données précédentes affichées, atténuées). */
  busy?: boolean
  empty?: ReactNode
  sort?: { key: string; dir: 'asc' | 'desc' }
  onSort?: (key: string) => void
  /** Cellule d'actions en fin de ligne. */
  actions?: (row: T) => ReactNode
  onRowClick?: (row: T) => void
}

/**
 * Tableau de liste standard : en-têtes triables, état de chargement, état vide,
 * colonne d'actions. À placer dans `<Card flush>` et suivre d'une `<Pagination>`.
 */
export default function DataTable<T>({
  columns,
  rows,
  rowKey,
  loading = false,
  busy = false,
  empty = 'Aucun résultat.',
  sort,
  onSort,
  actions,
  onRowClick,
}: DataTableProps<T>) {
  if (loading) {
    return <Spinner block />
  }

  if (rows.length === 0) {
    return typeof empty === 'string' ? <EmptyState title={empty} /> : <>{empty}</>
  }

  return (
    <div className={`overflow-x-auto transition-opacity ${busy ? 'opacity-60' : ''}`}>
      <table className="w-full text-left text-sm">
        <thead className="border-b border-black/[0.06] bg-white/30 text-[12px] font-medium text-gray-500">
          <tr>
            {columns.map((col) => {
              const active = sort?.key === col.key
              const clickable = col.sortable && onSort
              return (
                <th key={col.key} className={`px-4 py-3 font-medium ${col.className ?? ''}`}>
                  {clickable ? (
                    <button
                      type="button"
                      onClick={() => onSort(col.key)}
                      className={`inline-flex items-center gap-1 transition hover:text-gray-900 ${active ? 'text-gray-900' : ''}`}
                    >
                      {col.header}
                      <span className="text-[10px]" aria-hidden>
                        {active ? (sort?.dir === 'asc' ? '▲' : '▼') : '⇅'}
                      </span>
                    </button>
                  ) : (
                    col.header
                  )}
                </th>
              )
            })}
            {actions && <th className="px-4 py-3" />}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={rowKey(row)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={`border-b border-black/[0.05] last:border-0 ${onRowClick ? 'cursor-pointer hover:bg-gray-900/[0.025]' : ''}`}
            >
              {columns.map((col) => (
                <td key={col.key} className={`px-4 py-3 text-gray-800 ${col.className ?? ''}`}>
                  {col.render(row)}
                </td>
              ))}
              {actions && (
                <td className="whitespace-nowrap px-4 py-2 text-right" onClick={(e) => e.stopPropagation()}>
                  <div className="inline-flex items-center gap-1">{actions(row)}</div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
