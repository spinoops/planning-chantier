import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { enqueueOffline, isOffline } from '@/lib/offlineQueue'
import type { HoursSummary, TimeEntry, TimeEntryPayload, TimeEntryStatus } from '@/types'

export interface TimeEntryFilters {
  from: string
  to: string
  user_id?: number
  chantier_id?: number
  status?: TimeEntryStatus | ''
}

const KEY = 'heures'

/** Heures pointées d'une période (un ouvrier ne reçoit que les siennes). */
export function useTimeEntries(filters: TimeEntryFilters, enabled = true) {
  const params = { ...filters, user_id: filters.user_id || undefined, chantier_id: filters.chantier_id || undefined, status: filters.status || undefined }
  return useQuery({
    queryKey: [KEY, params],
    queryFn: async () => (await api.get<{ data: TimeEntry[] }>(`/${KEY}`, { params })).data.data,
    placeholderData: keepPreviousData,
    enabled,
  })
}

/**
 * Crée un pointage. Hors ligne, la saisie est mise en file d'attente locale et
 * envoyée au retour du réseau (voir lib/offlineQueue).
 */
export function useCreateTimeEntry() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: TimeEntryPayload) => {
      if (isOffline()) {
        enqueueOffline({ method: 'post', url: `/${KEY}`, body: payload })
        return null
      }
      return (await api.post<{ data: TimeEntry }>(`/${KEY}`, payload)).data.data
    },
    onSuccess: () => invalidate(queryClient),
  })
}

export function useUpdateTimeEntry() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, payload }: { id: number; payload: Partial<TimeEntryPayload> }) =>
      (await api.put<{ data: TimeEntry }>(`/${KEY}/${id}`, payload)).data.data,
    onSuccess: () => invalidate(queryClient),
  })
}

export function useDeleteTimeEntry() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/${KEY}/${id}`)
    },
    onSuccess: () => invalidate(queryClient),
  })
}

/** L'ouvrier soumet ses brouillons au bureau. */
export function useSubmitTimeEntries() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (ids: number[]) => (await api.post<{ message: string; count: number }>(`/${KEY}/submit`, { ids })).data,
    onSuccess: () => invalidate(queryClient),
  })
}

/** Le bureau valide (verrouille) des heures. */
export function useValidateTimeEntries() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (ids: number[]) => (await api.post<{ message: string; count: number }>(`/${KEY}/validate`, { ids })).data,
    onSuccess: () => invalidate(queryClient),
  })
}

/** Le bureau rouvre des heures validées. */
export function useReopenTimeEntries() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (ids: number[]) => (await api.post<{ message: string; count: number }>(`/${KEY}/reopen`, { ids })).data,
    onSuccess: () => invalidate(queryClient),
  })
}

/** Synthèse par personne et par chantier (planificateurs). */
export function useHoursSummary(range: { from: string; to: string }, enabled = true) {
  return useQuery({
    queryKey: [KEY, 'summary', range],
    queryFn: async () => (await api.get<HoursSummary>(`/${KEY}/summary`, { params: range })).data,
    placeholderData: keepPreviousData,
    enabled,
  })
}

function invalidate(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: [KEY] })
  queryClient.invalidateQueries({ queryKey: ['dashboard'] })
}
