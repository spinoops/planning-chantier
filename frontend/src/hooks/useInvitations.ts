import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { CreatedInvitation, Invitation, Paginated } from '@/types'

export interface InvitationPayload {
  email: string
  role?: string
}

const KEY = 'invitations'

/** Invitations émises : les siennes, ou toutes si l'on est administrateur. */
export function useInvitations(page = 1) {
  return useQuery({
    queryKey: [KEY, page],
    queryFn: async () => (await api.get<Paginated<Invitation>>(`/${KEY}`, { params: { page } })).data,
  })
}

/** Crée une invitation. La réponse contient le lien à transmettre. */
export function useCreateInvitation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: InvitationPayload) => (await api.post<CreatedInvitation>(`/${KEY}`, payload)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [KEY] }),
  })
}

/** Révoque une invitation encore en attente. */
export function useRevokeInvitation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/${KEY}/${id}`)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [KEY] }),
  })
}
