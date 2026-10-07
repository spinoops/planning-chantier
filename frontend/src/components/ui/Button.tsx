import type { ButtonHTMLAttributes } from 'react'

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost'
type Size = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
}

/*
 * Style Apple : bouton principal plein (couleur de l'app), secondaire « teinté »
 * gris sans bordure (comme iOS), léger rétrécissement au clic.
 */
const VARIANTS: Record<Variant, string> = {
  primary: 'bg-primary text-white hover:bg-primary-hover shadow-[0_1px_2px_rgb(0_0_0/0.12),inset_0_1px_0_rgb(255_255_255/0.12)]',
  secondary: 'bg-gray-900/[0.05] text-gray-900 hover:bg-gray-900/[0.09]',
  danger: 'bg-sys-red text-white hover:bg-sys-red-deep shadow-[0_1px_2px_rgb(0_0_0/0.12)]',
  ghost: 'text-gray-600 hover:bg-gray-900/[0.05] hover:text-gray-900',
}

const SIZES: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-[13px]',
  md: 'px-4 py-2 text-sm',
  lg: 'px-5 py-2.5 text-base',
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
      className={`inline-flex items-center justify-center gap-2 rounded-[10px] font-medium transition-all duration-150 focus:outline-none focus-visible:ring-[3px] focus-visible:ring-primary-ring active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100 ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      {...props}
    >
      {loading && (
        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />
      )}
      {children}
    </button>
  )
}
