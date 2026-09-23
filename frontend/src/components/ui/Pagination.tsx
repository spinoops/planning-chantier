import type { Paginated } from '@/types'

interface PaginationProps {
  meta: Paginated<unknown>['meta'] | undefined
  onPageChange: (page: number) => void
}

/** Fenêtre de numéros de page autour de la page courante (1 … 4 5 6 … 20). */
function pageWindow(current: number, last: number): number[] {
  if (last <= 7) return Array.from({ length: last }, (_, i) => i + 1)
  const pages = new Set([1, last, current, current - 1, current + 1])
  return [...pages].filter((p) => p >= 1 && p <= last).sort((a, b) => a - b)
}

/** Pagination d'une liste (meta Laravel). Ne s'affiche que s'il y a plusieurs pages. */
export default function Pagination({ meta, onPageChange }: PaginationProps) {
  if (!meta || meta.total === 0) {
    return null
  }

  const { current_page: current, last_page: last, total } = meta
  const pages = pageWindow(current, last)
  const cell = 'flex h-8 min-w-8 items-center justify-center rounded-md px-1.5 text-sm transition'

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 px-4 py-3">
      <span className="text-sm text-gray-500">
        {total} résultat{total > 1 ? 's' : ''}
      </span>
      {last > 1 && (
        <nav className="flex items-center gap-1" aria-label="Pagination">
          <button
            type="button"
            className={`${cell} text-gray-500 hover:bg-gray-100 disabled:opacity-30`}
            disabled={current <= 1}
            onClick={() => onPageChange(current - 1)}
            aria-label="Page précédente"
          >
            ‹
          </button>
          {pages.map((p, i) => {
            const gap = i > 0 && p - pages[i - 1] > 1
            return (
              <span key={p} className="flex items-center gap-1">
                {gap && <span className="px-1 text-gray-400">…</span>}
                <button
                  type="button"
                  onClick={() => onPageChange(p)}
                  aria-current={p === current ? 'page' : undefined}
                  className={`${cell} font-medium ${
                    p === current ? 'bg-primary text-white' : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  {p}
                </button>
              </span>
            )
          })}
          <button
            type="button"
            className={`${cell} text-gray-500 hover:bg-gray-100 disabled:opacity-30`}
            disabled={current >= last}
            onClick={() => onPageChange(current + 1)}
            aria-label="Page suivante"
          >
            ›
          </button>
        </nav>
      )}
    </div>
  )
}
