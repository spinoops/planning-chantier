export interface User {
  id: number
  name: string
  email: string
  phone: string | null
  /** Métier (maçon, grutier…). */
  job_title: string | null
  /** Couleur d'avatar (#rrggbb) ; sinon dérivée du nom. */
  color: string | null
  /** Équipe de rattachement (planification par équipe). */
  equipe_id: number | null
  equipe?: EquipeRef | null
  roles: string[]
  /** Permissions effectives (directes + héritées des rôles). */
  permissions: string[]
  email_verified_at: string | null
  /** Présent uniquement pour un compte supprimé (corbeille). */
  deleted_at?: string | null
  created_at: string
  updated_at: string
}

/** Réponse de POST /api/login et POST /api/register/{token}. */
export interface LoginResponse {
  token: string
  user: User
}

/** Rôle disponible (GET /api/roles). */
export interface Role {
  name: string
  label: string
}

export interface RolesResponse {
  data: Role[]
  /** Rôle attribué par défaut (invitations). */
  default: string
}

/** Réglages publics de l'app (GET /api/settings). */
export interface AppSettings {
  app_name: string
  app_logo_url: string
  app_color: string
  /** Modules activés (clé => bool), pour le menu et les gardes de route. */
  modules: Record<string, boolean>
  features: {
    invitations_for_everyone: boolean
  }
  /** Horaires types du planning (boutons Matin / Après-midi) et heure de veille des changements tardifs. */
  planning_morning_start: string
  planning_morning_end: string
  planning_afternoon_start: string
  planning_afternoon_end: string
  planning_notify_after: string
}

/** Champs modifiables de la configuration (PUT /api/settings). */
export type SettingsPayload = Pick<AppSettings, 'app_name' | 'app_logo_url' | 'app_color'> &
  Partial<Pick<AppSettings, 'planning_morning_start' | 'planning_morning_end' | 'planning_afternoon_start' | 'planning_afternoon_end' | 'planning_notify_after'>>

/** Module optionnel (GET /api/modules, admin). */
export interface AppModule {
  key: string
  name: string
  description: string
  available: boolean
  enabled: boolean
}

/** État d'une invitation. */
export type InvitationStatus = 'pending' | 'accepted' | 'expired'

/** Invitation émise (GET/POST /api/invitations). */
export interface Invitation {
  id: number
  email: string
  role: string
  status: InvitationStatus
  inviter?: { id: number; name: string }
  expires_at: string
  accepted_at: string | null
  created_at: string
}

/** Réponse de POST /api/invitations : le lien n'est renvoyé qu'à la création. */
export interface CreatedInvitation {
  data: Invitation
  accept_url: string
}

/** Réponse de GET /api/register/{token} : de quoi afficher le formulaire. */
export interface InvitationInfo {
  email: string
  inviter_name: string
  expires_at: string
}

/** Entrée du journal d'activité (GET /api/activity). */
export interface ActivityEntry {
  id: number
  log_name: string | null
  description: string
  event: string | null
  subject_type: string | null
  subject_id: number | null
  subject_label: string | null
  causer: { id: number; name: string } | null
  properties: Record<string, unknown>
  created_at: string
}

/** Données du tableau de bord (GET /api/dashboard). */
export interface DashboardData {
  is_admin: boolean
  is_planner: boolean
  recent_activity: ActivityEntry[]
  planning?: {
    today: string
    today_affectations: Affectation[]
    workers_total: number
    workers_assigned_today: number
    workers_absent_today: number
    workers_free_today: Pick<Worker, 'id' | 'name' | 'job_title' | 'color'>[]
    chantiers_active: number
    chantiers_planned: number
    week_affectations: number
  }
  /** Pilotage de la semaine courante (planificateurs). */
  week?: {
    from: string
    to: string
    days: {
      date: string
      affectations: number
      unstaffed: number
      free: { id: number; name: string; color: string | null }[]
      absent: { id: number; name: string; color: string | null }[]
    }[]
    hours_by_chantier: { chantier: { id: number; name: string; color: string }; worked_minutes: number; planned_minutes: number }[]
    worked_minutes: number
    planned_minutes: number
    entries_to_validate: number
    unread_signalements: number
    latest_signalements: Signalement[]
    absences: { id: number; user: { id: number; name: string; color: string | null }; start_date: string; end_date: string; type: string; type_label: string }[]
  }
  users?: { total: number; admins: number; new_this_month: number; trashed: number }
  invitations?: { pending: number } | null
  signups?: { label: string; count: number }[]
}

/** Sauvegarde de la base (GET /api/backups). */
export interface Backup {
  name: string
  size: number
  created_at: string
}

/** Enveloppe des listes paginées renvoyées par l'API (Laravel Resource). */
export interface Paginated<T> {
  data: T[]
  links: { first: string | null; last: string | null; prev: string | null; next: string | null }
  meta: { current_page: number; last_page: number; per_page: number; total: number }
}

/* ------------------------------------------------------------------------- */
/*  Planning chantier                                                         */
/* ------------------------------------------------------------------------- */

export type ChantierStatus = 'planned' | 'active' | 'paused' | 'done'

export const CHANTIER_STATUSES: { value: ChantierStatus; label: string }[] = [
  { value: 'planned', label: 'À venir' },
  { value: 'active', label: 'En cours' },
  { value: 'paused', label: 'Suspendu' },
  { value: 'done', label: 'Terminé' },
]

/** Chantier (GET /api/chantiers). */
export interface Chantier {
  id: number
  name: string
  client: string | null
  address: string | null
  city: string | null
  /** Couleur d'affichage dans le calendrier (#rrggbb). */
  color: string
  status: ChantierStatus
  status_label: string
  start_date: string | null
  end_date: string | null
  notes: string | null
  affectations_count?: number
  created_at: string
  updated_at: string
}

export type ChantierPayload = Pick<Chantier, 'name' | 'client' | 'address' | 'city' | 'color' | 'status' | 'start_date' | 'end_date' | 'notes'>

/** Membre de l'équipe affectable (GET /api/workers, et `workers` d'une affectation). */
export interface Worker {
  id: number
  name: string
  phone: string | null
  job_title: string | null
  color: string | null
  equipe_id: number | null
  roles?: string[]
}

/** Référence légère à une équipe (embarquée dans une affectation ou un compte). */
export interface EquipeRef {
  id: number
  name: string
  color: string
}

/** Équipe planifiable : un ou plusieurs employés, une couleur (GET /api/equipes). */
export interface Equipe extends EquipeRef {
  sort_order: number
  /** Équipe temporaire : masquée du planning après cette date (YYYY-MM-DD). */
  expires_at: string | null
  members: Worker[]
  affectations_count?: number
  created_at: string
  updated_at: string
}

export interface EquipePayload {
  name: string
  color: string
  sort_order?: number
  expires_at?: string | null
  /** Membres exacts : un employé quitte automatiquement son ancienne équipe. */
  member_ids: number[]
}

/** Un chantier placé sur un jour du calendrier, avec son équipe (GET /api/planning). */
export interface Affectation {
  id: number
  chantier_id: number
  /** Équipe planifiée (sa couleur teinte l'événement) ; null = ouvriers choisis un à un. */
  equipe_id: number | null
  equipe?: EquipeRef | null
  /** YYYY-MM-DD */
  date: string
  /** HH:MM ou null (journée). */
  start_time: string | null
  end_time: string | null
  /** Durée planifiée en minutes (0 si journée sans horaire). */
  planned_minutes: number
  note: string | null
  /** Étape du chantier (gros œuvre, finitions…). */
  phase: string | null
  chantier: Chantier
  workers: Worker[]
  /** Passages (patron / chef qui vient contrôler) : liés sans faire partie de l'équipe. */
  visitors: Worker[]
  photos_count?: number
  created_at: string
  updated_at: string
}

export interface AffectationPayload {
  chantier_id: number
  equipe_id?: number | null
  date: string
  start_time: string | null
  end_time: string | null
  note: string | null
  phase?: string | null
  worker_ids: number[]
  visitor_ids?: number[]
  /** Récurrence à la création : répéter jusqu'à cette date, les jours ISO donnés (1 = lundi). */
  repeat_until?: string | null
  repeat_days?: number[]
}

/* ------------------------------------------------------------------------- */
/*  Heures, absences, imprévus, photos                                        */
/* ------------------------------------------------------------------------- */

export type TimeEntryStatus = 'draft' | 'submitted' | 'validated'

/** Heures pointées par un employé (GET /api/heures). */
export interface TimeEntry {
  id: number
  user_id: number
  user?: Worker
  affectation_id: number | null
  chantier_id: number | null
  chantier?: Chantier | null
  date: string
  start_time: string
  end_time: string
  break_minutes: number
  /** Minutes travaillées (fin − début − pause). */
  minutes: number
  comment: string | null
  status: TimeEntryStatus
  status_label: string
  validated_at: string | null
  validator?: { id: number; name: string } | null
  created_at: string
  updated_at: string
}

export interface TimeEntryPayload {
  user_id?: number
  affectation_id?: number | null
  chantier_id?: number | null
  date: string
  start_time: string
  end_time: string
  break_minutes: number
  comment?: string | null
}

/** Synthèse des heures d'une période (GET /api/heures/summary, planificateurs). */
export interface HoursSummary {
  from: string
  to: string
  by_user: {
    user: { id: number; name: string; color: string | null; job_title: string | null }
    planned_minutes: number
    worked_minutes: number
    entries: number
    draft: number
    submitted: number
    validated: number
  }[]
  by_chantier: { chantier: { id: number; name: string; color: string }; worked_minutes: number; entries: number }[]
  totals: { worked_minutes: number; submitted: number; draft: number }
}

export type AbsenceType = 'vacances' | 'maladie' | 'ecole' | 'autre'

export const ABSENCE_TYPES: { value: AbsenceType; label: string }[] = [
  { value: 'vacances', label: 'Vacances' },
  { value: 'maladie', label: 'Maladie' },
  { value: 'ecole', label: 'École / formation' },
  { value: 'autre', label: 'Autre' },
]

/** Absence d'un employé (GET /api/absences). */
export interface Absence {
  id: number
  user_id: number
  user?: Worker
  start_date: string
  end_date: string
  type: AbsenceType
  type_label: string
  note: string | null
  created_at: string
}

export interface AbsencePayload {
  user_id: number
  start_date: string
  end_date: string
  type: AbsenceType
  note?: string | null
}

export type SignalementType = 'absence' | 'fin_anticipee' | 'materiel' | 'autre'

export const SIGNALEMENT_TYPES: { value: SignalementType; label: string }[] = [
  { value: 'absence', label: 'Absence / retard' },
  { value: 'fin_anticipee', label: 'Chantier terminé plus tôt' },
  { value: 'materiel', label: 'Matériel manquant' },
  { value: 'autre', label: 'Autre' },
]

/** Imprévu signalé depuis le chantier (GET /api/signalements). */
export interface Signalement {
  id: number
  user?: Worker
  affectation_id: number | null
  affectation?: { id: number; date: string; chantier: string | null } | null
  date: string | null
  type: SignalementType
  type_label: string
  message: string
  read_at: string | null
  created_at: string
}

export interface SignalementPayload {
  affectation_id?: number | null
  date?: string | null
  type: SignalementType
  message: string
}

/** Photo attachée à une affectation (GET /api/planning/{id}/photos). */
export interface AffectationPhoto {
  id: number
  affectation_id: number
  url: string
  caption: string | null
  user?: { id: number; name: string } | null
  created_at: string
}
