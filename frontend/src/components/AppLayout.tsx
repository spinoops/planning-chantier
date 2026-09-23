import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@/auth/AuthContext'
import { useSettings } from '@/hooks/useSettings'
import { applyBranding, DEFAULT_APP_NAME } from '@/lib/branding'
import { initials } from '@/lib/format'
import { ADMIN_ITEMS, NAV_ITEMS, visibleItems } from '@/lib/navigation'

/**
 * Cadre commun des pages connectées : en-tête avec logo/nom (Configuration),
 * navigation issue de lib/navigation.ts, menu utilisateur, tiroir mobile.
 */
export default function AppLayout() {
  const { user, logout, isAdmin } = useAuth()
  const { data: settings } = useSettings()
  const { pathname } = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const userMenuRef = useRef<HTMLDivElement>(null)

  const appName = settings?.app_name || DEFAULT_APP_NAME
  const modules = settings?.modules ?? {}
  const canInvite = settings?.features?.invitations_for_everyone ?? false
  const mainItems = visibleItems(NAV_ITEMS, user, modules, { canInvite })
  const adminItems = visibleItems(ADMIN_ITEMS, user, modules, { canInvite })
  const adminActive = adminItems.some((item) => pathname.startsWith(item.to))

  // Couleur / titre / favicon suivent la configuration.
  useEffect(() => applyBranding(settings), [settings])

  // Fermetures : Échap, clic en dehors du menu utilisateur (les liens ferment via onClick).
  const closeMenus = () => {
    setMenuOpen(false)
    setUserMenuOpen(false)
  }

  useEffect(() => {
    if (!menuOpen && !userMenuOpen) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setMenuOpen(false)
        setUserMenuOpen(false)
      }
    }
    function onDown(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) setUserMenuOpen(false)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onDown)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onDown)
    }
  }, [menuOpen, userMenuOpen])

  const navClass = ({ isActive }: { isActive: boolean }) =>
    `rounded-lg px-3 py-1.5 text-sm font-medium transition ${
      isActive ? 'bg-primary-soft text-primary' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
    }`
  const drawerClass = ({ isActive }: { isActive: boolean }) =>
    `block rounded-lg px-3 py-2.5 text-sm font-medium transition ${
      isActive ? 'bg-primary-soft text-primary' : 'text-gray-700 hover:bg-gray-100'
    }`

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-gray-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-2.5 sm:px-6">
          {/* Logo + nom */}
          <Link to="/dashboard" className="flex min-w-0 items-center gap-2">
            {settings?.app_logo_url ? (
              <img src={settings.app_logo_url} alt="" className="h-7 w-7 rounded object-contain" />
            ) : (
              <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-xs font-bold text-white">
                {initials(appName)}
              </span>
            )}
            <span className="truncate text-base font-semibold text-gray-900">{appName}</span>
          </Link>

          {/* Navigation principale (écrans larges) */}
          <nav className="no-scrollbar hidden min-w-0 items-center gap-1 overflow-x-auto md:flex">
            {mainItems.map((item) => (
              <NavLink key={item.to} to={item.to} className={navClass}>
                {item.label}
              </NavLink>
            ))}
            {adminItems.length > 0 && (
              <details className="group relative">
                <summary
                  className={`flex cursor-pointer list-none items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                    adminActive ? 'bg-primary-soft text-primary' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                >
                  Administration
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" className="transition group-open:rotate-180">
                    <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </summary>
                <div className="absolute left-0 top-full z-50 mt-1 min-w-44 overflow-hidden rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                  {adminItems.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      className={({ isActive }) =>
                        `block px-4 py-2 text-sm transition ${isActive ? 'bg-primary-soft text-primary' : 'text-gray-700 hover:bg-gray-50'}`
                      }
                    >
                      {item.label}
                    </NavLink>
                  ))}
                </div>
              </details>
            )}
          </nav>

          <div className="flex-1" />

          {/* Menu utilisateur (écrans larges) */}
          <div ref={userMenuRef} className="relative hidden md:block">
            <button
              type="button"
              onClick={() => setUserMenuOpen((o) => !o)}
              aria-haspopup="menu"
              aria-expanded={userMenuOpen}
              className="flex items-center gap-2 rounded-full border border-gray-200 py-1 pl-1 pr-3 text-sm transition hover:bg-gray-50"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-900 text-xs font-bold text-white">
                {initials(user?.name)}
              </span>
              <span className="max-w-40 truncate font-medium text-gray-700">{user?.name}</span>
            </button>
            {userMenuOpen && (
              <div role="menu" className="absolute right-0 top-full z-50 mt-1 w-56 overflow-hidden rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                <div className="border-b border-gray-100 px-4 py-2">
                  <p className="truncate text-sm font-medium text-gray-900">{user?.name}</p>
                  <p className="truncate text-xs text-gray-500">{user?.email}</p>
                  {isAdmin && <p className="mt-1 text-[11px] font-medium uppercase tracking-wide text-primary">Administrateur</p>}
                </div>
                <Link to="/profile" role="menuitem" onClick={closeMenus} className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                  Mon profil
                </Link>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => logout()}
                  className="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                >
                  Déconnexion
                </button>
              </div>
            )}
          </div>

          {/* Bouton menu (mobile) */}
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label="Ouvrir le menu"
            aria-expanded={menuOpen}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-700 md:hidden"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </header>

      {/* Tiroir de navigation (mobile) */}
      {menuOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/30" onClick={() => setMenuOpen(false)} aria-hidden />
          <div className="absolute inset-y-0 right-0 flex w-[min(320px,86vw)] flex-col bg-white shadow-2xl">
            <div className="flex items-center gap-3 border-b border-gray-100 px-4 py-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-900 text-xs font-bold text-white">
                {initials(user?.name)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-gray-900">{user?.name}</p>
                <p className="truncate text-xs text-gray-500">{user?.email}</p>
              </div>
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                aria-label="Fermer le menu"
                className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-gray-100"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            <nav className="flex-1 space-y-1 overflow-y-auto p-3">
              {mainItems.map((item) => (
                <NavLink key={item.to} to={item.to} className={drawerClass} onClick={closeMenus}>
                  {item.label}
                </NavLink>
              ))}
              {adminItems.length > 0 && (
                <>
                  <p className="mt-4 px-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400">Administration</p>
                  {adminItems.map((item) => (
                    <NavLink key={item.to} to={item.to} className={drawerClass} onClick={closeMenus}>
                      {item.label}
                    </NavLink>
                  ))}
                </>
              )}
              <p className="mt-4 px-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400">Compte</p>
              <NavLink to="/profile" className={drawerClass} onClick={closeMenus}>
                Mon profil
              </NavLink>
            </nav>
            <div className="border-t border-gray-100 p-3">
              <button
                type="button"
                onClick={() => logout()}
                className="block w-full rounded-lg px-3 py-2.5 text-left text-sm font-medium text-gray-700 hover:bg-gray-100"
              >
                Déconnexion
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
        <Outlet />
      </main>
    </div>
  )
}
