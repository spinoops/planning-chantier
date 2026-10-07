import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { SousTraitant, SousTraitantPayload } from '@/types'

const KEY = 'sous-traitants'

/** Tous les sous-traitants (sélecteur de la fiche chantier). */
export function useSousTraitants(enabled = true) {
  return useQuery({
    queryKey: [KEY],
    queryFn: async () => (await api.get<{ data: SousTraitant[] }>(`/${KEY}`)).data.data,
    staleTime: 5 * 60_000,
    enabled,
  })
}

export function useCreateSousTraitant() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: SousTraitantPayload) => (await api.post<{ data: SousTraitant }>(`/${KEY}`, payload)).data.data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [KEY] }),
  })
}

export function useUpdateSousTraitant() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, payload }: { id: number; payload: SousTraitantPayload }) => (await api.put<{ data: SousTraitant }>(`/${KEY}/${id}`, payload)).data.data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [KEY] })
      queryClient.invalidateQueries({ queryKey: ['chantiers'] })
    },
  })
}

export function useDeleteSousTraitant() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/${KEY}/${id}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [KEY] })
      queryClient.invalidateQueries({ queryKey: ['chantiers'] })
    },
  })
}
