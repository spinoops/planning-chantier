import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'

interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  /** false = ne se ferme pas au clic sur le fond ni avec Échap (formulaires longs). */
  dismissible?: boolean
  children: ReactNode
}

const SIZES: Record<NonNullable<ModalProps['size']>, string> = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
}

/**
 * Fenêtre modale rendue dans un portail (document.body) : une modale ouverte
 * depuis un formulaire n'est jamais imbriquée dans ce <form> (React 19 refuse
 * les formulaires imbriqués). Échap et clic sur le fond ferment si `dismissible`.
 * Style : feuille iOS sur mobile (bord supérieur arrondi), fenêtre macOS au-delà.
 */
export default function Modal({ open, onClose, title, size = 'md', dismissible = true, children }: ModalProps) {
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && dismissible) onClose()
    }
    document.addEventListener('keydown', onKey)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previousOverflow
    }
  }, [open, dismissible, onClose])

  if (!open) {
    return null
  }

  return createPortal(
    <div
      className="pc-fade fixed inset-0 z-50 flex items-end justify-center bg-[rgb(15_40_90/0.28)] p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onMouseDown={dismissible ? onClose : undefined}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`pc-pop max-h-[92vh] w-full ${SIZES[size]} glass-strong overflow-y-auto rounded-t-[28px] p-5 sm:max-h-[88vh] sm:rounded-[28px] sm:p-6`}
        onMouseDown={(event) => event.stopPropagation()}
      >
        {title && <h3 className="mb-4 text-[17px] font-semibold tracking-tight text-gray-900">{title}</h3>}
        {children}
      </div>
    </div>,
    document.body,
  )
}
