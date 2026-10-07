import type { SelectHTMLAttributes } from 'react'
import { forwardRef, useId } from 'react'
import { FIELD_CLASS, FIELD_ERROR, FIELD_OK, LABEL_CLASS } from '@/components/ui/Input'

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
}

const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, error, className = '', id, children, ...props },
  ref,
) {
  const generatedId = useId()
  const selectId = id ?? generatedId

  return (
    <div className="space-y-1">
      {label && (
        <label htmlFor={selectId} className={LABEL_CLASS}>
          {label}
        </label>
      )}
      <select
        ref={ref}
        id={selectId}
        aria-invalid={error ? true : undefined}
        className={`${FIELD_CLASS} ${error ? FIELD_ERROR : FIELD_OK} ${className}`}
        {...props}
      >
        {children}
      </select>
      {error && <p className="text-[13px] text-sys-red">{error}</p>}
    </div>
  )
})

export default Select
