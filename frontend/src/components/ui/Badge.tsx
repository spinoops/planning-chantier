import type { ReactNode } from 'react'

export type BadgeTone = 'neutral' | 'primary' | 'success' | 'warn' | 'danger' | 'info'

/* Pastilles teintées avec les couleurs système Apple. */
const TONES: Record<BadgeTone, string> = {
  neutral: 'bg-gray-900/[0.06] text-gray-700',
  primary: 'bg-primary-soft text-primary',
  success: 'bg-sys-green-soft text-sys-green-deep',
  warn: 'bg-sys-orange-soft text-sys-orange-deep',
  danger: 'bg-sys-red-soft text-sys-red-deep',
  info: 'bg-sys-blue-soft text-sys-blue-deep',
}

/** Pastille de statut / rôle. */
export default function Badge({
  children,
  tone = 'neutral',
  className = '',
}: {
  children: ReactNode
  tone?: BadgeTone
  className?: string
}) {
  return (
    <span className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${TONES[tone]} ${className}`}>
      {children}
    </span>
  )
}
