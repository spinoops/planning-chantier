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

/** Indicateur chiffré du tableau de bord. */
export default function StatCard({ label, value, hint, tone = 'default' }: StatCardProps) {
  return (
    <div className="rounded-card border border-black/[0.06] bg-white p-5 shadow-sm">
      <p className="text-[12px] font-semibold uppercase tracking-wide text-gray-500">{label}</p>
      <p className={`mt-2 text-[30px] font-bold leading-none tracking-tight tabular-nums ${TONES[tone]}`}>{value}</p>
      {hint && <p className="mt-2 text-xs text-gray-500">{hint}</p>}
    </div>
  )
}
