import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { Affectation, AffectationPayload } from '@/types'

export interface PlanningRange {
  /** YYYY-MM-DD inclus. */
  from: string
  to: string
  chantier_id?: number
  worker_id?: number
  /** true = uniquement mes affectations (page « Mon planning »). */
  mine?: boolean
}

const KEY = 'planning'

/** Affectations d'une période (avec chantier + équipe), pour le calendrier. */
export function usePlanning(range: PlanningRange, enabled = true) {
  const params = {
    from: range.from,
    to: range.to,
    chantier_id: range.chantier_id || undefined,
    worker_id: range.worker_id || undefined,
    mine: range.mine ? 1 : undefined,
  }
  return useQuery({
    queryKey: [KEY, params],
    queryFn: async () => (await api.get<{ data: Affectation[] }>(`/${KEY}`, { params })).data.data,
    placeholderData: keepPreviousData,
    enabled,
  })
}

export function useCreateAffectation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: AffectationPayload) => (await api.post<{ data: Affectation }>(`/${KEY}`, payload)).data.data,
    onSuccess: () => invalidatePlanning(queryClient),
  })
}

export function useUpdateAffectation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, payload }: { id: number; payload: Partial<AffectationPayload> }) =>
      (await api.put<{ data: Affectation }>(`/${KEY}/${id}`, payload)).data.data,
    onSuccess: () => invalidatePlanning(queryClient),
  })
}

export function useDeleteAffectation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/${KEY}/${id}`)
    },
    onSuccess: () => invalidatePlanning(queryClient),
  })
}

/** Copie toutes les affectations de la semaine `from` (lundi) vers la semaine `to` (lundi). */
export function useCopyWeek() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: { from: string; to: string; replace?: boolean }) =>
      (await api.post<{ message: string; created: number }>(`/${KEY}/copy-week`, payload)).data,
    onSuccess: () => invalidatePlanning(queryClient),
  })
}

function invalidatePlanning(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: [KEY] })
  queryClient.invalidateQueries({ queryKey: ['dashboard'] })
  queryClient.invalidateQueries({ queryKey: ['chantiers'] })
}
