import { useRef } from 'react'
import type { ChangeEvent } from 'react'
import { useUpload } from '@/hooks/useUpload'
import { getErrorMessage } from '@/lib/errors'
import { toast } from '@/lib/toast'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'

interface ImageFieldProps {
  label: string
  value: string
  onChange: (url: string) => void
  placeholder?: string
  hint?: string
  error?: string
}

/**
 * Champ image (logo…) : URL saisissable + bouton de téléversement (admin) + aperçu.
 * L'URL renvoyée par l'API est absolue (fichier servi via /storage).
 */
export default function ImageField({ label, value, onChange, placeholder, hint, error }: ImageFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const upload = useUpload()

  function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // autorise la re-sélection du même fichier
    if (!file) return
    upload.mutate(file, {
      onSuccess: (url) => {
        onChange(url)
        toast('Image téléversée.', 'success')
      },
      onError: (err) => toast(getErrorMessage(err, 'Téléversement impossible.'), 'error'),
    })
  }

  return (
    <div className="flex items-start gap-4">
      <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-dashed border-gray-300 bg-gray-50">
        {value ? (
          <img src={value} alt="" className="h-full w-full object-contain p-1" />
        ) : (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="text-gray-400">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <path d="M21 15l-5-5L5 21" />
          </svg>
        )}
      </div>
      <div className="flex-1 space-y-2">
        <Input
          label={label}
          type="url"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          hint={hint}
          error={error}
        />
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" loading={upload.isPending} onClick={() => inputRef.current?.click()}>
            Téléverser une image
          </Button>
          {value && (
            <Button variant="ghost" size="sm" onClick={() => onChange('')}>
              Retirer
            </Button>
          )}
        </div>
        <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="hidden" onChange={onFile} />
      </div>
    </div>
  )
}
