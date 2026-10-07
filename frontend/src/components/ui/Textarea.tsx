import type { TextareaHTMLAttributes } from 'react'
import { forwardRef, useId } from 'react'
import { FIELD_CLASS, FIELD_ERROR, FIELD_OK, LABEL_CLASS } from '@/components/ui/Input'

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
}

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, error, className = '', id, rows = 3, ...props },
  ref,
) {
  const generatedId = useId()
  const fieldId = id ?? generatedId

  return (
    <div className="space-y-1">
      {label && (
        <label htmlFor={fieldId} className={LABEL_CLASS}>
          {label}
        </label>
      )}
      <textarea
        ref={ref}
        id={fieldId}
        rows={rows}
        aria-invalid={error ? true : undefined}
        className={`${FIELD_CLASS} ${error ? FIELD_ERROR : FIELD_OK} ${className}`}
        {...props}
      />
      {error && <p className="text-[13px] text-sys-red">{error}</p>}
    </div>
  )
})

export default Textarea
