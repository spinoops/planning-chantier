import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { enqueueOffline, isOffline } from '@/lib/offlineQueue'
import type { Paginated, Signalement, SignalementPayload } from '@/types'

const KEY = 'signalements'

/** Imprévus signalés (un ouvrier : les siens ; planificateurs : tous, ?unread=1). */
export function useSignalements(options: { unread?: boolean; page?: number } = {}, enabled = true) {
  const params = { unread: options.unread ? 1 : undefined, page: options.page || undefined }
  return useQuery({
    queryKey: [KEY, params],
    queryFn: async () => (await api.get<Paginated<Signalement>>(`/${KEY}`, { params })).data,
    enabled,
  })
}

/** Envoie un imprévu au bureau (mis en file d'attente hors ligne). */
export function useCreateSignalement() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: SignalementPayload) => {
      if (isOffline()) {
        enqueueOffline({ method: 'post', url: `/${KEY}`, body: payload })
        return null
      }
      return (await api.post<{ data: Signalement }>(`/${KEY}`, payload)).data.data
    },
    onSuccess: () => invalidate(queryClient),
  })
}

/** Marque un imprévu comme traité (planificateurs). */
export function useReadSignalement() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => (await api.post<{ data: Signalement }>(`/${KEY}/${id}/read`)).data.data,
    onSuccess: () => invalidate(queryClient),
  })
}

export function useDeleteSignalement() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/${KEY}/${id}`)
    },
    onSuccess: () => invalidate(queryClient),
  })
}

function invalidate(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: [KEY] })
  queryClient.invalidateQueries({ queryKey: ['dashboard'] })
}
