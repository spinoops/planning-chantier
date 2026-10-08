import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { AideBlock } from '@/lib/aide'

/** Blocs du mode d'emploi (réservés aux personnes connectées). */
export function useAide() {
  return useQuery({
    queryKey: ['aide'],
    queryFn: async () => (await api.get<{ data: AideBlock[] }>('/aide')).data.data,
    staleTime: Infinity,
  })
}

/**
 * Une capture du mode d'emploi, chargée avec le jeton (une balise <img> ne peut pas l'envoyer)
 * et exposée comme URL d'objet, conservée pour la session.
 */
export function useAideImage(name: string) {
  return useQuery({
    queryKey: ['aide-image', name],
    queryFn: async () => {
      const blob = (await api.get<Blob>(`/aide/images/${encodeURIComponent(name)}`, { responseType: 'blob' })).data
      return URL.createObjectURL(blob)
    },
    staleTime: Infinity,
    gcTime: Infinity,
  })
}
