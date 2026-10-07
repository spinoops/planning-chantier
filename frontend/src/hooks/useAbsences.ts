import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { Absence, AbsencePayload } from '@/types'

const KEY = 'absences'

/** Absences touchant une période (tous les connectés : le planning grise les absents). */
export function useAbsences(range: { from: string; to: string }, enabled = true) {
  return useQuery({
    queryKey: [KEY, range],
    queryFn: async () => (await api.get<{ data: Absence[] }>(`/${KEY}`, { params: range })).data.data,
    placeholderData: keepPreviousData,
    staleTime: 60_000,
    enabled,
  })
}

export function useCreateAbsence() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: AbsencePayload) => (await api.post<{ data: Absence }>(`/${KEY}`, payload)).data.data,
    onSuccess: () => invalidate(queryClient),
  })
}

export function useUpdateAbsence() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, payload }: { id: number; payload: AbsencePayload }) => (await api.put<{ data: Absence }>(`/${KEY}/${id}`, payload)).data.data,
    onSuccess: () => invalidate(queryClient),
  })
}

export function useDeleteAbsence() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/${KEY}/${id}`)
    },
    onSuccess: () => invalidate(queryClient),
  })
}

/** Vrai si la personne est absente ce jour (clé YYYY-MM-DD). */
export function isAbsentOn(absences: Absence[], userId: number, date: string): Absence | undefined {
  return absences.find((a) => a.user_id === userId && a.start_date <= date && a.end_date >= date)
}

function invalidate(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: [KEY] })
  queryClient.invalidateQueries({ queryKey: ['dashboard'] })
}
