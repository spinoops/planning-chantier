import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { Equipe, EquipePayload } from '@/types'

const KEY = 'equipes'

/**
 * Équipes avec leurs membres (colonne de gauche du planning, sélecteurs).
 * `all=true` inclut les équipes temporaires expirées (page Équipes).
 */
export function useEquipes(all = false) {
  return useQuery({
    queryKey: [KEY, { all }],
    queryFn: async () => (await api.get<{ data: Equipe[] }>(`/${KEY}`, { params: all ? { all: 1 } : undefined })).data.data,
    staleTime: 5 * 60_000,
  })
}

export function useCreateEquipe() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: EquipePayload) => (await api.post<{ data: Equipe }>(`/${KEY}`, payload)).data.data,
    onSuccess: () => invalidate(queryClient),
  })
}

export function useUpdateEquipe() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, payload }: { id: number; payload: EquipePayload }) =>
      (await api.put<{ data: Equipe }>(`/${KEY}/${id}`, payload)).data.data,
    onSuccess: () => invalidate(queryClient),
  })
}

export function useDeleteEquipe() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/${KEY}/${id}`)
    },
    onSuccess: () => invalidate(queryClient),
  })
}

/** Les membres changent d'équipe → équipe, liste des employés et planning (couleurs) à rafraîchir. */
function invalidate(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: [KEY] })
  queryClient.invalidateQueries({ queryKey: ['workers'] })
  queryClient.invalidateQueries({ queryKey: ['users'] })
  queryClient.invalidateQueries({ queryKey: ['planning'] })
}
