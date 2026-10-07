import type { User } from '@/types'
import { isAdmin } from '@/lib/roles'

/**
 * Menu principal de l'application.
 *
 *   - admin    : entrée réservée aux administrateurs.
 *   - module   : entrée visible seulement si le module (config/modules.php) est actif.
 *   - roles    : entrée visible pour au moins un de ces rôles (les admins passent toujours).
 *   - children : sous-menu déroulant (le menu reste court : une entrée par domaine).
 *
 * `make:crud --front` ajoute automatiquement une ligne avant le repère « make:crud ».
 */
export interface NavItem {
  to: string
  label: string
  admin?: boolean
  module?: string
  roles?: string[]
  children?: NavItem[]
}

/** Rôles qui gèrent chantiers et planning (miroir de config/roles.php → planners). */
export const PLANNER_ROLES = ['admin', 'gestionnaire', 'chef']

export const NAV_ITEMS: NavItem[] = [
  { to: '/dashboard', label: 'Tableau de bord', roles: PLANNER_ROLES },
  { to: '/planning', label: 'Planning', roles: PLANNER_ROLES },
  {
    to: '/chantiers',
    label: 'Chantiers',
    roles: PLANNER_ROLES,
    children: [
      { to: '/chantiers', label: 'Tous les chantiers' },
      { to: '/clients', label: 'Clients' },
    ],
  },
  {
    to: '/equipes',
    label: 'Équipe',
    roles: PLANNER_ROLES,
    children: [
      { to: '/equipes', label: 'Équipes' },
      { to: '/absences', label: 'Absences' },
    ],
  },
  {
    to: '/statistiques',
    label: 'Statistiques',
    roles: PLANNER_ROLES,
    children: [{ to: '/statistiques/heures', label: 'Heures' }],
  },
  { to: '/mon-planning', label: 'Mon planning' },
  // make:crud
]

/** Entrées d'administration (menu « Administration »). */
export const ADMIN_ITEMS: NavItem[] = [
  { to: '/users', label: 'Équipe & comptes', admin: true },
  { to: '/invitations', label: 'Invitations', module: 'invitations' },
  { to: '/activity', label: 'Journal', admin: true },
  { to: '/settings', label: 'Configuration', admin: true },
]

/** Vrai si le compte peut planifier (admin, gestionnaire ou chef de chantier). */
export function isPlanner(user: User | null | undefined): boolean {
  return isAdmin(user) || Boolean(user?.roles?.some((r) => PLANNER_ROLES.includes(r)))
}

/** Page d'accueil selon le rôle : le tableau de bord pour les planificateurs, « Mon planning » sinon. */
export function homePath(user: User | null | undefined): string {
  return isPlanner(user) ? '/dashboard' : '/mon-planning'
}

/** Vrai si l'entrée (ou l'un de ses sous-menus) correspond au chemin courant. */
export function isItemActive(item: NavItem, pathname: string): boolean {
  const targets = item.children?.map((c) => c.to) ?? [item.to]
  return targets.some((to) => pathname === to || pathname.startsWith(`${to}/`))
}

/** Filtre les entrées (et leurs sous-menus) visibles pour cet utilisateur et ces modules. */
export function visibleItems(
  items: NavItem[],
  user: User | null | undefined,
  modules: Record<string, boolean>,
  extra: { canInvite?: boolean } = {},
): NavItem[] {
  return items.flatMap((item) => {
    if (item.admin && !isAdmin(user)) return []
    if (item.module && !modules[item.module]) return []
    if (item.roles && !isAdmin(user) && !item.roles.some((r) => user?.roles?.includes(r))) return []
    if (item.to === '/invitations' && !isAdmin(user) && !extra.canInvite) return []
    if (item.children) {
      const children = visibleItems(item.children, user, modules, extra)
      return children.length > 0 ? [{ ...item, children }] : []
    }
    return [item]
  })
}
