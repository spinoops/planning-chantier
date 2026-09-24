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
}

/** Champs modifiables de la configuration (PUT /api/settings). */
export type SettingsPayload = Pick<AppSettings, 'app_name' | 'app_logo_url' | 'app_color'>

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
    workers_free_today: Pick<Worker, 'id' | 'name' | 'job_title' | 'color'>[]
    chantiers_active: number
    chantiers_planned: number
    week_affectations: number
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
  members: Worker[]
  affectations_count?: number
  created_at: string
  updated_at: string
}

export interface EquipePayload {
  name: string
  color: string
  sort_order?: number
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
  note: string | null
  chantier: Chantier
  workers: Worker[]
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
  worker_ids: number[]
}
