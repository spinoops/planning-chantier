/** Palette proposée pour la couleur d'un chantier (lisible en fond clair). */
export const CHANTIER_COLORS = ['#2563eb', '#ea580c', '#16a34a', '#9333ea', '#dc2626', '#0891b2', '#ca8a04', '#db2777', '#4f46e5', '#0d9488', '#65a30d', '#78716c']

/** Prochaine couleur de la palette la moins utilisée parmi des couleurs déjà prises. */
export function nextColor(palette: string[], used: string[]): string {
  const counts = new Map(palette.map((c) => [c, 0]))
  for (const u of used) if (counts.has(u)) counts.set(u, (counts.get(u) ?? 0) + 1)
  let best = palette[0]
  for (const [c, n] of counts) if (n < (counts.get(best) ?? 0)) best = c
  return best
}
