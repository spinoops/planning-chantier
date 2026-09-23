import { useMutation } from '@tanstack/react-query'
import { api } from '@/lib/api'

/** Téléverse une image (PNG/JPG/WebP/SVG, 4 Mo max) et renvoie son URL (POST /api/uploads, admin). */
export function useUpload() {
  return useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData()
      form.append('file', file)
      const { data } = await api.post<{ url: string }>('/uploads', form)
      return data.url
    },
  })
}
