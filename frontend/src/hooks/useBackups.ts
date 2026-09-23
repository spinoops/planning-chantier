import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, downloadFile } from '@/lib/api'
import type { Backup } from '@/types'

const KEY = 'backups'

/** Sauvegardes de la base de données (admin, module « backups »). */
export function useBackups(enabled = true) {
  return useQuery({
    queryKey: [KEY],
    queryFn: async () => (await api.get<{ data: Backup[] }>(`/${KEY}`)).data.data,
    enabled,
  })
}

export function useCreateBackup() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => (await api.post<{ name: string; message: string }>(`/${KEY}`)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [KEY] }),
  })
}

export function useDeleteBackup() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (name: string) => {
      await api.delete(`/${KEY}/${encodeURIComponent(name)}`)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [KEY] }),
  })
}

export function useDownloadBackup() {
  return useMutation({
    mutationFn: (name: string) => downloadFile(`/${KEY}/${encodeURIComponent(name)}/download`, name),
  })
}
