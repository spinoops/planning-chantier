import type { Affectation } from '@/types'

/** Regroupe les affectations par jour (clé « YYYY-MM-DD »), dans l'ordre reçu de l'API. */
export function groupByDay(affectations: Affectation[]): Map<string, Affectation[]> {
  const map = new Map<string, Affectation[]>()
  for (const a of affectations) {
    const list = map.get(a.date)
    if (list) list.push(a)
    else map.set(a.date, [a])
  }
  return map
}
