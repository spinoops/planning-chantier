import { useMutation } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useAuth } from '@/auth/AuthContext'
import type { User } from '@/types'

export interface ProfilePayload {
  name: string
  email: string
  phone?: string | null
}

export interface PasswordPayload {
  current_password: string
  password: string
  password_confirmation: string
}

/** Met à jour nom/email de l'utilisateur connecté (et le contexte d'auth). */
export function useUpdateProfile() {
  const { setUser } = useAuth()
  return useMutation({
    mutationFn: async (payload: ProfilePayload) => (await api.put<User>('/profile', payload)).data,
    onSuccess: (user) => setUser(user),
  })
}

/** Change le mot de passe (l'ancien est exigé) ; les autres appareils sont déconnectés. */
export function useUpdatePassword() {
  return useMutation({
    mutationFn: async (payload: PasswordPayload) => (await api.put<{ message: string }>('/profile/password', payload)).data,
  })
}
