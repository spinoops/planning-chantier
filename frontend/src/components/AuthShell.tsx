import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { useSettings } from '@/hooks/useSettings'
import { applyBranding, DEFAULT_APP_NAME, DEFAULT_LOGO } from '@/lib/branding'

interface AuthShellProps {
  title: string
  children: ReactNode
}

/**
 * Cadre des pages publiques (connexion, mot de passe, inscription) : fond doux
 * avec halos colorés, carte en verre dépoli centrée, logo + nom de l'app.
 */
export default function AuthShell({ title, children }: AuthShellProps) {
  const { data: settings } = useSettings()
  const appName = settings?.app_name || DEFAULT_APP_NAME

  useEffect(() => applyBranding(settings), [settings])

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10">
      <div className="pointer-events-none absolute -left-40 -top-40 h-[28rem] w-[28rem] rounded-full bg-primary/15 blur-3xl" aria-hidden />
      <div className="pointer-events-none absolute -bottom-48 -right-32 h-[26rem] w-[26rem] rounded-full bg-sys-purple/10 blur-3xl" aria-hidden />
      <div className="pointer-events-none absolute right-1/4 top-1/3 h-72 w-72 rounded-full bg-sys-teal/10 blur-3xl" aria-hidden />

      <div className="relative w-full max-w-sm">
        <div className="mb-7 flex flex-col items-center gap-3">
          <img src={settings?.app_logo_url || DEFAULT_LOGO} alt={appName} className="h-16 w-auto max-w-[260px] object-contain" />
          <span className="text-[15px] font-medium text-gray-600">{appName}</span>
        </div>
        <div className="glass-strong space-y-4 rounded-[28px] p-8">
          <h1 className="text-[17px] font-semibold tracking-tight text-gray-900">{title}</h1>
          {children}
        </div>
      </div>
    </div>
  )
}
