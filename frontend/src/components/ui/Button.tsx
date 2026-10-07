import type { ButtonHTMLAttributes } from 'react'

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost'
type Size = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
}

/*
 * Capsules façon iOS 26 / macOS Tahoe : principal plein avec reflet (`gloss`),
 * secondaire en verre (`glass-pill`), léger rétrécissement au clic.
 */
const VARIANTS: Record<Variant, string> = {
  primary: 'gloss bg-primary text-white hover:bg-primary-hover',
  secondary: 'glass-pill text-gray-900',
  danger: 'bg-sys-red text-white hover:bg-sys-red-deep shadow-[inset_0_1px_0_rgb(255_255_255/0.3),0_6px_16px_-6px_rgb(255_59_48/0.6)]',
  ghost: 'text-gray-700 hover:bg-white/50 hover:text-gray-900',
}

const SIZES: Record<Size, string> = {
  sm: 'px-3.5 py-1.5 text-[13px]',
  md: 'px-4.5 py-2 text-sm',
  lg: 'px-6 py-2.5 text-base',
}

/**
 * Bouton du kit UI. `variant="primary"` suit la couleur principale de l'app
 * (Configuration). `loading` désactive le bouton et affiche un indicateur.
 */
export default function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  className = '',
  type = 'button',
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 rounded-full font-medium transition-all duration-150 focus:outline-none focus-visible:ring-[3px] focus-visible:ring-primary-ring active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100 ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      {...props}
    >
      {loading && (
        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />
      )}
      {children}
    </button>
  )
}
