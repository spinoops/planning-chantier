import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@/auth/AuthContext'
import { useSettings } from '@/hooks/useSettings'
import { applyBranding, DEFAULT_APP_NAME } from '@/lib/branding'
import { initials } from '@/lib/format'
import { ADMIN_ITEMS, NAV_ITEMS, visibleItems } from '@/lib/navigation'

/** Routes affichées sur toute la largeur de l'écran (calendrier). */
const FULL_WIDTH_PREFIXES = ['/planning']

/**
 * Cadre commun des pages connectées : barre translucide (verre dépoli, façon
 * macOS) avec logo/nom (Configuration), navigation issue de lib/navigation.ts,
 * menu utilisateur, tiroir mobile.
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
  const fullWidth = FULL_WIDTH_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))

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
    `whitespace-nowrap rounded-full px-3.5 py-1.5 text-[13px] font-medium transition ${
      isActive ? 'bg-gray-900/[0.07] text-gray-900' : 'text-gray-600 hover:bg-gray-900/[0.05] hover:text-gray-900'
    }`
  const drawerClass = ({ isActive }: { isActive: boolean }) =>
    `block rounded-xl px-3 py-2.5 text-[15px] font-medium transition ${
      isActive ? 'bg-primary-soft text-primary' : 'text-gray-800 hover:bg-gray-900/[0.05]'
    }`
  const menuItemClass = 'block rounded-lg px-3 py-1.5 text-[13px] text-gray-800 transition hover:bg-primary hover:text-white'

  return (
    <div className="min-h-screen">
      <header className="glass sticky top-0 z-40 border-b border-black/[0.06]">
        <div className="flex items-center gap-4 px-4 py-2 sm:px-6">
          {/* Logo + nom */}
          <Link to="/dashboard" className="flex min-w-0 items-center gap-2.5">
            {settings?.app_logo_url ? (
              <img src={settings.app_logo_url} alt="" className="h-7 w-7 rounded-lg object-contain" />
            ) : (
              <span className="flex h-7 w-7 items-center justify-center rounded-[8px] bg-gradient-to-b from-primary to-primary-hover text-[11px] font-bold text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.25)]">
                {initials(appName)}
              </span>
            )}
            <span className="truncate text-[15px] font-semibold tracking-tight text-gray-900">{appName}</span>
          </Link>

          {/* Navigation principale (écrans larges) */}
          <nav className="no-scrollbar hidden min-w-0 items-center gap-0.5 overflow-x-auto md:flex">
            {mainItems.map((item) => (
              <NavLink key={item.to} to={item.to} className={navClass}>
                {item.label}
              </NavLink>
            ))}
            {adminItems.length > 0 && (
              <details className="group relative">
                <summary
                  className={`flex cursor-pointer list-none items-center gap-1 whitespace-nowrap rounded-full px-3.5 py-1.5 text-[13px] font-medium transition ${
                    adminActive ? 'bg-gray-900/[0.07] text-gray-900' : 'text-gray-600 hover:bg-gray-900/[0.05] hover:text-gray-900'
                  }`}
                >
                  Administration
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" className="transition group-open:rotate-180">
                    <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </summary>
                <div className="pc-pop glass absolute left-0 top-full z-50 mt-1.5 min-w-48 rounded-xl p-1 shadow-lg ring-1 ring-black/5">
                  {adminItems.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      className={({ isActive }) => `${menuItemClass} ${isActive ? 'font-semibold' : ''}`}
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
              className="flex items-center gap-2 rounded-full bg-gray-900/[0.05] py-1 pl-1 pr-3 text-[13px] transition hover:bg-gray-900/[0.09]"
            >
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-b from-gray-700 to-gray-900 text-[10px] font-bold text-white">
                {initials(user?.name)}
              </span>
              <span className="max-w-40 truncate font-medium text-gray-800">{user?.name}</span>
            </button>
            {userMenuOpen && (
              <div role="menu" className="pc-pop glass absolute right-0 top-full z-50 mt-1.5 w-60 rounded-xl p-1 shadow-lg ring-1 ring-black/5">
                <div className="px-3 pb-2 pt-1.5">
                  <p className="truncate text-[13px] font-semibold text-gray-900">{user?.name}</p>
                  <p className="truncate text-xs text-gray-500">{user?.email}</p>
                  {isAdmin && <p className="mt-1 text-[11px] font-medium uppercase tracking-wide text-primary">Administrateur</p>}
                </div>
                <div className="mx-2 my-1 border-t border-black/[0.06]" />
                <Link to="/profile" role="menuitem" onClick={closeMenus} className={menuItemClass}>
                  Mon profil
                </Link>
                <button type="button" role="menuitem" onClick={() => logout()} className={`${menuItemClass} w-full text-left`}>
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
            className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-900/[0.05] text-gray-800 md:hidden"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </header>

      {/* Tiroir de navigation (mobile) */}
      {menuOpen && (
        <div className="pc-fade fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/25 backdrop-blur-[2px]" onClick={() => setMenuOpen(false)} aria-hidden />
          <div className="glass absolute inset-y-0 right-0 flex w-[min(320px,86vw)] flex-col rounded-l-3xl shadow-2xl">
            <div className="flex items-center gap-3 border-b border-black/[0.06] px-4 py-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-b from-gray-700 to-gray-900 text-xs font-bold text-white">
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
                className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-900/[0.06] text-gray-600 hover:bg-gray-900/[0.1]"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6">
                  <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
              {mainItems.map((item) => (
                <NavLink key={item.to} to={item.to} className={drawerClass} onClick={closeMenus}>
                  {item.label}
                </NavLink>
              ))}
              {adminItems.length > 0 && (
                <>
                  <p className="mt-4 px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-gray-400">Administration</p>
                  {adminItems.map((item) => (
                    <NavLink key={item.to} to={item.to} className={drawerClass} onClick={closeMenus}>
                      {item.label}
                    </NavLink>
                  ))}
                </>
              )}
              <p className="mt-4 px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-gray-400">Compte</p>
              <NavLink to="/profile" className={drawerClass} onClick={closeMenus}>
                Mon profil
              </NavLink>
            </nav>
            <div className="border-t border-black/[0.06] p-3">
              <button
                type="button"
                onClick={() => logout()}
                className="block w-full rounded-xl px-3 py-2.5 text-left text-[15px] font-medium text-sys-red hover:bg-sys-red-soft"
              >
                Déconnexion
              </button>
            </div>
          </div>
        </div>
      )}

      <main className={fullWidth ? 'px-3 py-4 sm:px-4' : 'mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8'}>
        <Outlet />
      </main>
    </div>
  )
}
