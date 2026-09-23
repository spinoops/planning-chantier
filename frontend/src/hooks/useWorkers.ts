import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { Worker } from '@/types'

/**
 * Équipe affectable (ouvriers + chefs), triée par nom. Réservée aux
 * planificateurs ; `enabled=false` pour un ouvrier (403 sinon).
 */
export function useWorkers(enabled = true) {
  return useQuery({
    queryKey: ['workers'],
    queryFn: async () => (await api.get<{ data: Worker[] }>('/workers')).data.data,
    staleTime: 5 * 60_000,
    enabled,
  })
}
