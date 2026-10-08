/**
 * Mode d'emploi intégré (page /aide). Le texte et les captures sont servis par l'API
 * (`GET /aide`, `GET /aide/images/{nom}`) aux personnes connectées seulement ; les fichiers
 * sont dans `backend/resources/aide/`. Texte : **gras** et *italique* seulement.
 */
export type AideBlock =
  | { t: 'h1' | 'h2'; text: string; id: string }
  | { t: 'p' | 'li' | 'ol' | 'tip'; text: string }
  | { t: 'img'; src: string; caption: string; w: number; h: number; mobile: boolean }

export interface AideChapter {
  id: string
  title: string
  number: number
  sections: { id: string; title: string }[]
}

/** Sommaire : chapitres numérotés (comme dans le PDF) et leurs sections. */
export function chaptersOf(blocks: AideBlock[]): AideChapter[] {
  return blocks.reduce<AideChapter[]>((list, b) => {
    if (b.t === 'h1') list.push({ id: b.id, title: b.text, number: list.length + 1, sections: [] })
    else if (b.t === 'h2' && list.length) list[list.length - 1].sections.push({ id: b.id, title: b.text })
    return list
  }, [])
}

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
  ['/profile', 'recevoir-une-alerte-avant-chaque-chantier'],
]

export function aideSectionFor(pathname: string): string | null {
  return CONTEXT.find(([prefix]) => pathname === prefix || pathname.startsWith(prefix + '/'))?.[1] ?? null
}
