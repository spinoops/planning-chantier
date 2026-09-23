import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { ActivityEntry, Paginated } from '@/types'

export interface ActivityFilters {
  page?: number
  search?: string
  event?: string
  subject_type?: string
  causer_id?: number
  per_page?: number
}

/** Journal d'activité (admin), paginé et filtrable. */
export function useActivity(filters: ActivityFilters) {
  return useQuery({
    queryKey: ['activity', filters],
    queryFn: async () => (await api.get<Paginated<ActivityEntry>>('/activity', { params: filters })).data,
    placeholderData: keepPreviousData,
  })
}
