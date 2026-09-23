import type { InputHTMLAttributes, ReactNode } from 'react'
import { forwardRef, useId } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  /** Aide affichée sous le champ (absente s'il y a une erreur). */
  hint?: ReactNode
}

/** Classes communes aux champs de saisie du kit (Input, Select, Textarea). */
export const FIELD_CLASS =
  'w-full rounded-lg border bg-white px-3 py-2 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:ring-2 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500'
export const FIELD_OK = 'border-gray-300 focus:border-primary focus:ring-primary-ring'
export const FIELD_ERROR = 'border-red-400 focus:border-red-500 focus:ring-red-200'

const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, hint, className = '', id, ...props },
  ref,
) {
  const generatedId = useId()
  const inputId = id ?? generatedId

  return (
    <div className="space-y-1">
      {label && (
        <label htmlFor={inputId} className="block text-sm font-medium text-gray-700">
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
        <p className="text-sm text-red-600">{error}</p>
      ) : (
        hint && <p className="text-xs text-gray-500">{hint}</p>
      )}
    </div>
  )
})

export default Input
