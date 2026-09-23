import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { ListParams } from '@/hooks/useListParams'
import type { Paginated, User } from '@/types'

export interface UserPayload {
  name: string
  email: string
  password?: string
  roles: string[]
  phone?: string | null
  job_title?: string | null
  color?: string | null
}

export interface UserFilters extends Partial<ListParams> {
  role?: string
  /** true = corbeille (comptes supprimés). */
  trashed?: boolean
}

const KEY = 'users'

/** Liste paginée des utilisateurs (recherche, rôle, corbeille, tri). */
export function useUsers(filters: UserFilters) {
  const params = { ...filters, trashed: filters.trashed ? 1 : undefined, role: filters.role || undefined }
  return useQuery({
    queryKey: [KEY, params],
    queryFn: async () => (await api.get<Paginated<User>>(`/${KEY}`, { params })).data,
    placeholderData: keepPreviousData,
  })
}

export function useCreateUser() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: UserPayload) => (await api.post<{ data: User }>(`/${KEY}`, payload)).data.data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [KEY] }),
  })
}

export function useUpdateUser() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, payload }: { id: number; payload: UserPayload }) =>
      (await api.put<{ data: User }>(`/${KEY}/${id}`, payload)).data.data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [KEY] }),
  })
}

export function useDeleteUser() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/${KEY}/${id}`)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [KEY] }),
  })
}

/** Restaure un compte supprimé (corbeille). */
export function useRestoreUser() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => (await api.post<{ data: User }>(`/${KEY}/${id}/restore`)).data.data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [KEY] }),
  })
}
