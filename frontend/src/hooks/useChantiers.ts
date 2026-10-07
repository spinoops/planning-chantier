import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, downloadFile } from '@/lib/api'
import type { ListParams } from '@/hooks/useListParams'
import type { Chantier, ChantierPayload, ChantierRecap, ChantierStatus, Paginated } from '@/types'

export interface ChantierFilters extends Partial<ListParams> {
  status?: ChantierStatus | ''
  /** true = uniquement à venir + en cours. */
  open?: boolean
}

const KEY = 'chantiers'

/** Liste paginée des chantiers (recherche, statut, tri). */
export function useChantiers(filters: ChantierFilters) {
  const params = { ...filters, status: filters.status || undefined, open: filters.open ? 1 : undefined }
  return useQuery({
    queryKey: [KEY, params],
    queryFn: async () => (await api.get<Paginated<Chantier>>(`/${KEY}`, { params })).data,
    placeholderData: keepPreviousData,
  })
}

/**
 * Tous les chantiers planifiables (à venir + en cours), pour les sélecteurs et
 * filtres du calendrier. Une seule page large, mise en cache 5 minutes.
 */
export function useOpenChantiers() {
  return useQuery({
    queryKey: [KEY, 'open'],
    queryFn: async () => (await api.get<Paginated<Chantier>>(`/${KEY}`, { params: { open: 1, per_page: 200, sort: 'name', dir: 'asc' } })).data.data,
    staleTime: 5 * 60_000,
  })
}

export function useCreateChantier() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: ChantierPayload) => (await api.post<{ data: Chantier }>(`/${KEY}`, payload)).data.data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [KEY] }),
  })
}

export function useUpdateChantier() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, payload }: { id: number; payload: ChantierPayload }) =>
      (await api.put<{ data: Chantier }>(`/${KEY}/${id}`, payload)).data.data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [KEY] })
      // Les affectations embarquent le chantier (nom, couleur) : on les rafraîchit aussi.
      queryClient.invalidateQueries({ queryKey: ['planning'] })
    },
  })
}

export function useDeleteChantier() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/${KEY}/${id}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [KEY] })
      queryClient.invalidateQueries({ queryKey: ['planning'] })
    },
  })
}

/** Fiche complète d'un chantier (client, sous-traitants, étapes du déroulé). */
export function useChantier(id: number | null | undefined) {
  return useQuery({
    queryKey: [KEY, 'detail', id],
    queryFn: async () => (await api.get<{ data: Chantier }>(`/${KEY}/${id}`)).data.data,
    enabled: Boolean(id),
  })
}

/** Récapitulatif pour la facturation (planificateurs). `from` / `to` optionnels. */
export function useChantierRecap(id: number | null | undefined, range: { from?: string; to?: string } = {}, enabled = true) {
  return useQuery({
    queryKey: [KEY, 'recap', id, range],
    queryFn: async () => (await api.get<ChantierRecap>(`/${KEY}/${id}/recap`, { params: range })).data,
    enabled: Boolean(id) && enabled,
    placeholderData: keepPreviousData,
  })
}

/** Télécharge le récapitulatif CSV d'un chantier. */
export function downloadRecapCsv(chantier: Pick<Chantier, 'id' | 'name'>, range: { from?: string; to?: string } = {}): Promise<void> {
  const params = new URLSearchParams()
  if (range.from) params.set('from', range.from)
  if (range.to) params.set('to', range.to)
  const qs = params.toString()
  return downloadFile(`/${KEY}/${chantier.id}/recap.csv${qs ? `?${qs}` : ''}`, `recap-${chantier.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.csv`)
}
