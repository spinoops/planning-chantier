import type { AppSettings } from '@/types'

export const DEFAULT_APP_NAME = 'Planning Chantier'
export const DEFAULT_COLOR = '#e30917'
/** Logo par défaut (Top Stores, variante pour fonds clairs) ; `app_logo_url` (Configuration) le remplace. */
export const DEFAULT_LOGO = '/logo.svg'

/**
 * Applique l'identité de l'app (Configuration) à toute l'interface :
 * couleur principale (variable CSS `--color-primary`, utilisée par Tailwind
 * via `bg-primary`, `text-primary`…), titre de l'onglet et favicon.
 */
export function applyBranding(settings: Partial<AppSettings> | undefined): void {
  const root = document.documentElement
  const color = settings?.app_color && /^#[0-9a-f]{6}$/i.test(settings.app_color) ? settings.app_color : DEFAULT_COLOR
  root.style.setProperty('--color-primary', color)

  document.title = settings?.app_name || DEFAULT_APP_NAME

  const link = document.querySelector<HTMLLinkElement>('link[rel="icon"]')
  if (link) {
    link.href = settings?.app_logo_url || '/favicon.svg'
  }
}
