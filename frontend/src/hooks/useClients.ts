import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { ListParams } from '@/hooks/useListParams'
import type { Client, ClientPayload, Paginated } from '@/types'

const KEY = 'clients'

/** Liste paginée des clients (page Clients). */
export function useClients(filters: Partial<ListParams>) {
  return useQuery({
    queryKey: [KEY, filters],
    queryFn: async () => (await api.get<Paginated<Client>>(`/${KEY}`, { params: filters })).data,
    placeholderData: keepPreviousData,
  })
}

/** Tous les clients (sélecteur de la fiche chantier), mis en cache 5 minutes. */
export function useAllClients(enabled = true) {
  return useQuery({
    queryKey: [KEY, 'all'],
    queryFn: async () => (await api.get<Paginated<Client>>(`/${KEY}`, { params: { per_page: 200, sort: 'name', dir: 'asc' } })).data.data,
    staleTime: 5 * 60_000,
    enabled,
  })
}

export function useCreateClient() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: ClientPayload) => (await api.post<{ data: Client }>(`/${KEY}`, payload)).data.data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [KEY] }),
  })
}

export function useUpdateClient() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, payload }: { id: number; payload: ClientPayload }) => (await api.put<{ data: Client }>(`/${KEY}/${id}`, payload)).data.data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [KEY] })
      queryClient.invalidateQueries({ queryKey: ['chantiers'] })
    },
  })
}

export function useDeleteClient() {
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
