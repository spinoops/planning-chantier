import type { InputHTMLAttributes, ReactNode } from 'react'
import { forwardRef, useId } from 'react'

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: ReactNode
  error?: string
}

/** Case à cocher avec libellé, compatible react-hook-form (`{...register('x')}`). */
const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { label, error, className = '', id, ...props },
  ref,
) {
  const generatedId = useId()
  const fieldId = id ?? generatedId

  return (
    <div className="space-y-1">
      <label htmlFor={fieldId} className={`inline-flex cursor-pointer items-center gap-2 text-sm text-gray-700 ${className}`}>
        <input
          ref={ref}
          id={fieldId}
          type="checkbox"
          className="h-4 w-4 rounded border-gray-300 accent-primary focus:ring-primary-ring"
          {...props}
        />
        {label}
      </label>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  )
})

export default Checkbox
