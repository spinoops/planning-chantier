import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { useSettings } from '@/hooks/useSettings'
import { applyBranding, DEFAULT_APP_NAME } from '@/lib/branding'
import { initials } from '@/lib/format'

interface AuthShellProps {
  title: string
  children: ReactNode
}

/** Cadre des pages publiques (connexion, mot de passe, inscription) : logo + nom de l'app, carte centrée. */
export default function AuthShell({ title, children }: AuthShellProps) {
  const { data: settings } = useSettings()
  const appName = settings?.app_name || DEFAULT_APP_NAME

  useEffect(() => applyBranding(settings), [settings])

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center justify-center gap-2">
          {settings?.app_logo_url ? (
            <img src={settings.app_logo_url} alt="" className="h-9 w-9 rounded object-contain" />
          ) : (
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-sm font-bold text-white">
              {initials(appName)}
            </span>
          )}
          <span className="text-lg font-semibold text-gray-900">{appName}</span>
        </div>
        <div className="space-y-4 rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
          <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
          {children}
        </div>
      </div>
    </div>
  )
}
