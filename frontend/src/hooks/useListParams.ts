import { useCallback, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

/** Paramètres d'une liste paginée, envoyés tels quels à l'API (?page=&search=&sort=&dir=). */
export interface ListParams {
  page: number
  search: string
  sort: string
  dir: 'asc' | 'desc'
  per_page: number
}

const DEFAULTS: ListParams = { page: 1, search: '', sort: 'created_at', dir: 'desc', per_page: 15 }

/**
 * Page, recherche et tri d'une liste, synchronisés avec l'URL (?page=2&search=…) :
 * le bouton « retour » et le rechargement conservent l'état de la liste.
 *
 *   const { params, setPage, setSearch, setSort } = useListParams({ sort: 'name', dir: 'asc' })
 *   const { data } = useFactures(params)
 */
export function useListParams(defaults: Partial<ListParams> = {}) {
  const [searchParams, setSearchParams] = useSearchParams()
  // Les défauts sont figés au premier rendu (objet littéral recréé à chaque rendu sinon).
  const [base] = useState<ListParams>(() => ({ ...DEFAULTS, ...defaults }))

  const params = useMemo<ListParams>(
    () => ({
      page: Math.max(1, Number(searchParams.get('page')) || base.page),
      search: searchParams.get('search') ?? base.search,
      sort: searchParams.get('sort') ?? base.sort,
      dir: (searchParams.get('dir') as ListParams['dir'] | null) ?? base.dir,
      per_page: Number(searchParams.get('per_page')) || base.per_page,
    }),
    [searchParams, base],
  )

  const update = useCallback(
    (patch: Partial<ListParams>) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          const merged = { ...params, ...patch }
          // Seules les valeurs différentes des défauts figurent dans l'URL.
          for (const key of Object.keys(DEFAULTS) as (keyof ListParams)[]) {
            const value = merged[key]
            if (value === base[key] || value === '' || value === undefined) next.delete(key)
            else next.set(key, String(value))
          }
          return next
        },
        { replace: true },
      )
    },
    [params, base, setSearchParams],
  )

  const setPage = useCallback((page: number) => update({ page }), [update])
  const setSearch = useCallback((search: string) => update({ search, page: 1 }), [update])
  const setPerPage = useCallback((per_page: number) => update({ per_page, page: 1 }), [update])
  /** Clic sur un en-tête de colonne : même colonne → inverse le sens, sinon tri ascendant. */
  const setSort = useCallback(
    (sort: string) => update({ sort, dir: params.sort === sort && params.dir === 'asc' ? 'desc' : 'asc', page: 1 }),
    [update, params.sort, params.dir],
  )

  return { params, setPage, setSearch, setSort, setPerPage, update }
}
