import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { AffectationPhoto } from '@/types'

/** Photos d'une affectation. */
export function usePhotos(affectationId: number | null | undefined) {
  return useQuery({
    queryKey: ['photos', affectationId],
    queryFn: async () => (await api.get<{ data: AffectationPhoto[] }>(`/planning/${affectationId}/photos`)).data.data,
    enabled: Boolean(affectationId),
  })
}

/** Téléverse une photo (multipart). */
export function useUploadPhoto() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ affectationId, file, caption }: { affectationId: number; file: File; caption?: string }) => {
      const form = new FormData()
      form.append('file', file)
      if (caption) form.append('caption', caption)
      return (await api.post<{ data: AffectationPhoto }>(`/planning/${affectationId}/photos`, form, { headers: { 'Content-Type': 'multipart/form-data' } })).data.data
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ['photos', vars.affectationId] })
      queryClient.invalidateQueries({ queryKey: ['planning'] })
    },
  })
}

export function useDeletePhoto() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ affectationId, photoId }: { affectationId: number; photoId: number }) => {
      await api.delete(`/planning/${affectationId}/photos/${photoId}`)
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ['photos', vars.affectationId] })
      queryClient.invalidateQueries({ queryKey: ['planning'] })
    },
  })
}
