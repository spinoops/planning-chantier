import { initials } from '@/lib/format'

/** Palette d'avatars quand aucune couleur n'est définie sur le compte. */
const PALETTE = ['#2563eb', '#7c3aed', '#db2777', '#ca8a04', '#16a34a', '#dc2626', '#0891b2', '#ea580c', '#4f46e5', '#0d9488']

/** Couleur stable dérivée du nom (même personne → même couleur). */
// eslint-disable-next-line react-refresh/only-export-components
export function colorFor(name: string | null | undefined, color?: string | null): string {
  if (color && /^#[0-9a-f]{6}$/i.test(color)) return color
  let hash = 0
  for (const ch of name ?? '') hash = (hash * 31 + ch.charCodeAt(0)) | 0
  return PALETTE[Math.abs(hash) % PALETTE.length]
}

type Size = 'xs' | 'sm' | 'md' | 'lg'

const SIZES: Record<Size, string> = {
  xs: 'h-5 w-5 text-[9px]',
  sm: 'h-6 w-6 text-[10px]',
  md: 'h-8 w-8 text-xs',
  lg: 'h-11 w-11 text-sm',
}

interface AvatarProps {
  name: string
  color?: string | null
  size?: Size
  className?: string
  title?: string
}

/** Pastille ronde avec les initiales, colorée par compte. */
export default function Avatar({ name, color, size = 'md', className = '', title }: AvatarProps) {
  return (
    <span
      title={title ?? name}
      aria-label={name}
      className={`inline-flex shrink-0 select-none items-center justify-center rounded-full font-bold text-white ring-2 ring-white ${SIZES[size]} ${className}`}
      style={{ backgroundColor: colorFor(name, color) }}
    >
      {initials(name)}
    </span>
  )
}

interface AvatarGroupProps {
  people: { id: number; name: string; color?: string | null }[]
  /** Nombre d'avatars affichés avant le « +N ». */
  max?: number
  size?: Size
}

/** Ligne d'avatars superposés avec débordement « +N ». */
export function AvatarGroup({ people, max = 4, size = 'sm' }: AvatarGroupProps) {
  const shown = people.slice(0, max)
  const rest = people.length - shown.length
  if (people.length === 0) return null
  return (
    <span className="inline-flex items-center -space-x-1.5">
      {shown.map((p) => (
        <Avatar key={p.id} name={p.name} color={p.color} size={size} />
      ))}
      {rest > 0 && (
        <span
          className={`inline-flex items-center justify-center rounded-full bg-gray-200 font-semibold text-gray-600 ring-2 ring-white ${SIZES[size]}`}
          title={people.slice(max).map((p) => p.name).join(', ')}
        >
          +{rest}
        </span>
      )}
    </span>
  )
}
