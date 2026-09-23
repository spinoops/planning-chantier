import type { ReactNode } from 'react'

interface StatCardProps {
  label: string
  value: ReactNode
  hint?: ReactNode
  tone?: 'default' | 'primary' | 'warn' | 'danger'
}

const TONES = {
  default: 'text-gray-900',
  primary: 'text-primary',
  warn: 'text-amber-600',
  danger: 'text-red-600',
}

/** Indicateur chiffré du tableau de bord. */
export default function StatCard({ label, value, hint, tone = 'default' }: StatCardProps) {
  return (
    <div className="rounded-card border border-gray-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
      <p className={`mt-2 text-3xl font-semibold tabular-nums ${TONES[tone]}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-gray-500">{hint}</p>}
    </div>
  )
}
