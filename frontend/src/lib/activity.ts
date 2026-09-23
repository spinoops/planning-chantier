import type { ActivityEntry } from '@/types'

/** Verbes affichés pour les événements du journal d'activité. */
export const EVENT_LABELS: Record<string, string> = {
  created: 'a créé',
  updated: 'a modifié',
  deleted: 'a supprimé',
  restored: 'a restauré',
  login: "s'est connecté(e)",
  invited: 'a invité',
  password_changed: 'a changé son mot de passe',
  settings_updated: 'a modifié la configuration',
  backup: 'a lancé une sauvegarde',
}

/** Événements qui portent sur un sujet nommé ("… a modifié User Alice"). */
const WITH_SUBJECT = ['created', 'updated', 'deleted', 'restored']

/** Phrase lisible d'une entrée du journal ("Admin a créé User Alice"). */
export function describeActivity(entry: ActivityEntry): string {
  const who = entry.causer?.name ?? 'Système'
  const action = EVENT_LABELS[entry.event ?? ''] ?? entry.description
  const subject =
    entry.event && WITH_SUBJECT.includes(entry.event) && entry.subject_type
      ? `${entry.subject_type} ${entry.subject_label ?? `#${entry.subject_id}`}`
      : ''

  return [who, action, subject].filter(Boolean).join(' ')
}
