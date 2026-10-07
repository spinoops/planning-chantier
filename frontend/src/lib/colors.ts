/** Palette proposée pour la couleur d'un chantier (lisible en fond clair). */
export const CHANTIER_COLORS = ['#007aff', '#ff9500', '#34c759', '#af52de', '#ff3b30', '#30b0c7', '#ffcc00', '#ff2d55', '#5856d6', '#00c7be', '#a2845e', '#8e8e93']

/** Prochaine couleur de la palette la moins utilisée parmi des couleurs déjà prises. */
export function nextColor(palette: string[], used: string[]): string {
  const counts = new Map(palette.map((c) => [c, 0]))
  for (const u of used) if (counts.has(u)) counts.set(u, (counts.get(u) ?? 0) + 1)
  let best = palette[0]
  for (const [c, n] of counts) if (n < (counts.get(best) ?? 0)) best = c
  return best
}
