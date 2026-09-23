import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useSettings } from '@/hooks/useSettings'
import type { AppModule, AppSettings } from '@/types'

/** Liste des modules avec métadonnées et état (admin). */
export function useModules() {
  return useQuery({
    queryKey: ['modules'],
    queryFn: async () => (await api.get<{ data: AppModule[] }>('/modules')).data.data,
  })
}

/** Active/désactive des modules (admin), avec mise à jour optimiste du menu. */
export function useUpdateModules() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (modules: Record<string, boolean>) =>
      (await api.put<{ data: AppModule[] }>('/modules', { modules })).data.data,
    onMutate: async (vars) => {
      await queryClient.cancelQueries({ queryKey: ['modules'] })
      const prevModules = queryClient.getQueryData<AppModule[]>(['modules'])
      const prevSettings = queryClient.getQueryData<AppSettings>(['settings'])

      queryClient.setQueryData<AppModule[]>(['modules'], (old) =>
        old?.map((m) => (vars[m.key] !== undefined ? { ...m, enabled: vars[m.key] } : m)),
      )
      queryClient.setQueryData<AppSettings>(['settings'], (old) =>
        old ? { ...old, modules: { ...old.modules, ...vars } } : old,
      )

      return { prevModules, prevSettings }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prevModules) queryClient.setQueryData(['modules'], ctx.prevModules)
      if (ctx?.prevSettings) queryClient.setQueryData(['settings'], ctx.prevSettings)
    },
    onSuccess: (data) => queryClient.setQueryData(['modules'], data),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['settings'] }),
  })
}

/** Indique si un module est activé (lu depuis les réglages publics). */
export function useModuleEnabled(key: string): boolean {
  const { data } = useSettings()
  return data?.modules?.[key] ?? false
}
