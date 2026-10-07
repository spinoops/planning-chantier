import type { InputHTMLAttributes, ReactNode } from 'react'
import { forwardRef, useId } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  /** Aide affichée sous le champ (absente s'il y a une erreur). */
  hint?: ReactNode
}

/**
 * Classes communes aux champs de saisie du kit (Input, Select, Textarea) :
 * champ légèrement teinté façon macOS, qui devient blanc avec un halo bleu au focus.
 */
export const FIELD_CLASS =
  'w-full rounded-xl border bg-white/55 px-3 py-2 text-sm text-gray-900 shadow-[inset_0_1px_2px_rgb(15_40_90/0.06)] outline-none transition placeholder:text-gray-400 focus:bg-white/95 focus:ring-[3px] disabled:cursor-not-allowed disabled:bg-white/30 disabled:text-gray-500'
export const FIELD_OK = 'border-white/70 focus:border-primary/50 focus:ring-primary-ring'
export const FIELD_ERROR = 'border-sys-red/50 focus:border-sys-red focus:ring-sys-red/20'
/** Libellé standard des champs. */
export const LABEL_CLASS = 'block text-[13px] font-medium text-gray-600'

const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, hint, className = '', id, ...props },
  ref,
) {
  const generatedId = useId()
  const inputId = id ?? generatedId

  return (
    <div className="space-y-1">
      {label && (
        <label htmlFor={inputId} className={LABEL_CLASS}>
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={inputId}
        aria-invalid={error ? true : undefined}
        className={`${FIELD_CLASS} ${error ? FIELD_ERROR : FIELD_OK} ${className}`}
        {...props}
      />
      {error ? (
        <p className="text-[13px] text-sys-red">{error}</p>
      ) : (
        hint && <p className="text-xs text-gray-500">{hint}</p>
      )}
    </div>
  )
})

export default Input
