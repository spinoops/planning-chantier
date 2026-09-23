import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { AppSettings, SettingsPayload } from '@/types'

/** Réglages publics de l'app (identité, modules actifs). */
export function useSettings() {
  return useQuery({
    queryKey: ['settings'],
    queryFn: async () => (await api.get<AppSettings>('/settings')).data,
    staleTime: 5 * 60_000,
  })
}

/** Met à jour l'identité de l'app (admin). */
export function useUpdateSettings() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: SettingsPayload) => (await api.put<AppSettings>('/settings', payload)).data,
    onSuccess: (data) => queryClient.setQueryData(['settings'], data),
  })
}
