import type { ReactNode } from 'react'

export type BadgeTone = 'neutral' | 'primary' | 'success' | 'warn' | 'danger' | 'info'

const TONES: Record<BadgeTone, string> = {
  neutral: 'bg-gray-100 text-gray-700',
  primary: 'bg-primary-soft text-primary',
  success: 'bg-green-50 text-green-700',
  warn: 'bg-amber-50 text-amber-700',
  danger: 'bg-red-50 text-red-700',
  info: 'bg-blue-50 text-blue-700',
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
