import content from '@/content/aide.json'

/**
 * Mode d'emploi intégré (page /aide). Le contenu vient de `content/aide.json`, le même
 * texte que le mode d'emploi Word (`_construction/Planning-Chantier-Mode-d-emploi.docx`) ;
 * les captures sont dans `public/aide/`. Texte : **gras** et *italique* seulement.
 */
export type AideBlock =
  | { t: 'h1' | 'h2'; text: string; id: string }
  | { t: 'p' | 'li' | 'ol' | 'tip'; text: string }
  | { t: 'img'; src: string; caption: string; w: number; h: number; mobile: boolean }

export const AIDE_BLOCKS = content as AideBlock[]

export interface AideChapter {
  id: string
  title: string
  number: number
  sections: { id: string; title: string }[]
}

/** Sommaire : chapitres numérotés (comme dans le PDF) et leurs sections. */
export const AIDE_CHAPTERS: AideChapter[] = AIDE_BLOCKS.reduce<AideChapter[]>((list, b) => {
  if (b.t === 'h1') list.push({ id: b.id, title: b.text, number: list.length + 1, sections: [] })
  else if (b.t === 'h2' && list.length) list[list.length - 1].sections.push({ id: b.id, title: b.text })
  return list
}, [])

/** Chapitre de l'employé (téléphone) : mis en avant pour les comptes non planificateurs. */
export const AIDE_EMPLOYEE_SECTION = 'sur-le-telephone-mon-planning'

/** Section de l'aide correspondant à la page en cours (bouton « ? » contextuel). */
const CONTEXT: [prefix: string, section: string][] = [
  ['/dashboard', 'tableau-de-bord'],
  ['/planning', 'planning'],
  ['/chantiers', 'chantiers'],
  ['/clients', 'clients'],
  ['/equipes', 'equipes'],
  ['/absences', 'absences'],
  ['/statistiques', 'statistiques-les-heures'],
  ['/mon-planning', AIDE_EMPLOYEE_SECTION],
  ['/users', 'comptes-et-roles'],
  ['/settings', 'configuration'],
  ['/profile', 'mon-profil'],
]

export function aideSectionFor(pathname: string): string | null {
  return CONTEXT.find(([prefix]) => pathname === prefix || pathname.startsWith(prefix + '/'))?.[1] ?? null
}
