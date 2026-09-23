import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { RolesResponse } from '@/types'

/** Rôles disponibles avec libellés (admin) — pour les formulaires utilisateur / invitation. */
export function useRoles(enabled = true) {
  return useQuery({
    queryKey: ['roles'],
    queryFn: async () => (await api.get<RolesResponse>('/roles')).data,
    staleTime: 5 * 60_000,
    enabled,
  })
}
