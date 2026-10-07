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
  warn: 'text-sys-orange-deep',
  danger: 'text-sys-red',
}

/** Indicateur chiffré du tableau de bord (panneau en verre). */
export default function StatCard({ label, value, hint, tone = 'default' }: StatCardProps) {
  return (
    <div className="glass-panel rounded-card p-5">
      <p className="text-[12px] font-semibold uppercase tracking-wide text-gray-500">{label}</p>
      <p className={`mt-2 text-[30px] font-bold leading-none tracking-tight tabular-nums ${TONES[tone]}`}>{value}</p>
      {hint && <p className="mt-2 text-xs text-gray-500">{hint}</p>}
    </div>
  )
}
