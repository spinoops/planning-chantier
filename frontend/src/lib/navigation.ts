import type { User } from '@/types'
import { isAdmin } from '@/lib/roles'

/**
 * Menu principal de l'application.
 *
 *   - admin  : entrée réservée aux administrateurs.
 *   - module : entrée visible seulement si le module (config/modules.php) est actif.
 *   - roles  : entrée visible pour au moins un de ces rôles (les admins passent toujours).
 *
 * `make:crud --front` ajoute automatiquement une ligne avant le repère « make:crud ».
 */
export interface NavItem {
  to: string
  label: string
  admin?: boolean
  module?: string
  roles?: string[]
}

/** Rôles qui gèrent chantiers et planning (miroir de config/roles.php → planners). */
export const PLANNER_ROLES = ['admin', 'chef']

export const NAV_ITEMS: NavItem[] = [
  { to: '/planning', label: 'Planning', roles: PLANNER_ROLES },
  { to: '/chantiers', label: 'Chantiers', roles: PLANNER_ROLES },
  { to: '/equipes', label: 'Équipes', roles: PLANNER_ROLES },
  { to: '/mon-planning', label: 'Mon planning' },
  { to: '/dashboard', label: 'Tableau de bord', roles: PLANNER_ROLES },
  // make:crud
]

/** Entrées d'administration (menu « Administration »). */
export const ADMIN_ITEMS: NavItem[] = [
  { to: '/users', label: 'Équipe & comptes', admin: true },
  { to: '/invitations', label: 'Invitations', module: 'invitations' },
  { to: '/activity', label: 'Journal', admin: true },
  { to: '/settings', label: 'Configuration', admin: true },
]

/** Vrai si le compte peut planifier (admin ou chef de chantier). */
export function isPlanner(user: User | null | undefined): boolean {
  return isAdmin(user) || Boolean(user?.roles?.some((r) => PLANNER_ROLES.includes(r)))
}

/** Page d'accueil selon le rôle : le planning pour les planificateurs, « Mon planning » sinon. */
export function homePath(user: User | null | undefined): string {
  return isPlanner(user) ? '/planning' : '/mon-planning'
}

/** Filtre les entrées visibles pour cet utilisateur et ces modules. */
export function visibleItems(
  items: NavItem[],
  user: User | null | undefined,
  modules: Record<string, boolean>,
  extra: { canInvite?: boolean } = {},
): NavItem[] {
  return items.filter((item) => {
    if (item.admin && !isAdmin(user)) return false
    if (item.module && !modules[item.module]) return false
    if (item.roles && !isAdmin(user) && !item.roles.some((r) => user?.roles?.includes(r))) return false
    if (item.to === '/invitations' && !isAdmin(user) && !extra.canInvite) return false
    return true
  })
}
