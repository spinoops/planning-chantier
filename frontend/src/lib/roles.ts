import type { User } from '@/types'

/** Vrai si le compte a le rôle administrateur. */
export function isAdmin(user: User | null | undefined): boolean {
  return Boolean(user?.roles?.includes('admin'))
}

/** Vrai si le compte a au moins un des rôles donnés. */
export function hasRole(user: User | null | undefined, ...roles: string[]): boolean {
  return Boolean(user?.roles?.some((role) => roles.includes(role)))
}

/**
 * Vrai si le compte possède la permission (spatie/laravel-permission).
 * Un admin passe toujours : il est réputé tout pouvoir, comme côté API.
 */
export function can(user: User | null | undefined, permission: string): boolean {
  return isAdmin(user) || Boolean(user?.permissions?.includes(permission))
}
