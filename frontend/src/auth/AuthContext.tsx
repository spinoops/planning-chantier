import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { api, getToken, onUnauthorized, setToken } from '@/lib/api'
import { can as canPermission, hasRole as hasRoleFn, isAdmin as isAdminFn } from '@/lib/roles'
import type { LoginResponse, User } from '@/types'

interface AuthContextValue {
  user: User | null
  /** true tant que le token stocké n'a pas été validé auprès de l'API. */
  loading: boolean
  isAdmin: boolean
  login: (email: string, password: string) => Promise<void>
  /** Ouvre une session à partir d'un token déjà obtenu (inscription sur invitation). */
  authenticate: (token: string, user: User) => void
  logout: () => Promise<void>
  /** Recharge l'utilisateur depuis l'API (après changement de rôle, etc.). */
  refresh: () => Promise<void>
  /** Remplace l'utilisateur courant (après mise à jour du profil). */
  setUser: (user: User) => void
  hasRole: (...roles: string[]) => boolean
  can: (permission: string) => boolean
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [user, setUserState] = useState<User | null>(null)
  // loading démarre à true seulement s'il y a un token à valider.
  const [loading, setLoading] = useState(() => Boolean(getToken()))

  // Au chargement : si un token existe, on récupère l'utilisateur courant.
  useEffect(() => {
    if (!getToken()) {
      return
    }

    api
      .get<User>('/user')
      .then((response) => setUserState(response.data))
      .catch(() => setToken(null))
      .finally(() => setLoading(false))
  }, [])

  // Token expiré ou révoqué côté serveur (401) : on ferme la session localement.
  useEffect(
    () =>
      onUnauthorized(() => {
        setUserState(null)
        queryClient.clear()
      }),
    [queryClient],
  )

  const login = useCallback(async (email: string, password: string) => {
    const response = await api.post<LoginResponse>('/login', { email, password, device_name: 'spa' })
    setToken(response.data.token)
    setUserState(response.data.user)
  }, [])

  const authenticate = useCallback((token: string, nextUser: User) => {
    setToken(token)
    setUserState(nextUser)
  }, [])

  const logout = useCallback(async () => {
    try {
      await api.post('/logout')
    } catch {
      // le token est peut-être déjà invalide : on ferme la session quand même
    } finally {
      setToken(null)
      setUserState(null)
      queryClient.clear()
    }
  }, [queryClient])

  const refresh = useCallback(async () => {
    const response = await api.get<User>('/user')
    setUserState(response.data)
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      isAdmin: isAdminFn(user),
      login,
      authenticate,
      logout,
      refresh,
      setUser: setUserState,
      hasRole: (...roles) => hasRoleFn(user, ...roles),
      can: (permission) => canPermission(user, permission),
    }),
    [user, loading, login, authenticate, logout, refresh],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error("useAuth doit être utilisé à l'intérieur de <AuthProvider>.")
  }
  return context
}
