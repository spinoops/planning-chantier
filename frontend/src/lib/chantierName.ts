/*
 * Titre d'un chantier = nom du client, suivi d'un complément facultatif :
 * « Joray François – Garage ». Le client se choisit d'abord, le complément précise
 * le lieu ou l'ouvrage quand un client a plusieurs chantiers.
 */
export const CHANTIER_NAME_SEP = ' – '

/** Compose le titre à partir du client et du complément (l'un des deux suffit). */
export function buildChantierName(clientName: string | null | undefined, complement: string): string {
  const client = (clientName ?? '').trim()
  const extra = complement.trim()
  if (client && extra) return `${client}${CHANTIER_NAME_SEP}${extra}`
  return client || extra
}

/** Retrouve le complément d'un titre existant (ce qui suit le nom du client). */
export function complementOf(name: string | null | undefined, clientName: string | null | undefined): string {
  const title = (name ?? '').trim()
  const client = (clientName ?? '').trim()
  if (!client) return title
  if (title.toLowerCase() === client.toLowerCase()) return ''
  if (title.toLowerCase().startsWith(client.toLowerCase())) {
    return title
      .slice(client.length)
      .replace(/^[\s–\-·:,/]+/, '')
      .trim()
  }
  return title
}
