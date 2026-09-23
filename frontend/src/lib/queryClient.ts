import { QueryClient } from '@tanstack/react-query'

/** Client TanStack Query partagé (cache, retries, revalidation). */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 30_000,
    },
  },
})
