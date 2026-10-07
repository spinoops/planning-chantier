import { useEffect, useState } from 'react'
import { useDebounce } from '@/hooks/useDebounce'

interface SearchInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}

/** Champ de recherche avec temporisation : `onChange` n'est appelé qu'une fois la saisie stabilisée. */
export default function SearchInput({ value, onChange, placeholder = 'Rechercher…', className = '' }: SearchInputProps) {
  const [draft, setDraft] = useState(value)
  const [syncedValue, setSyncedValue] = useState(value)
  const debounced = useDebounce(draft, 300)

  // Resynchronise si la valeur change de l'extérieur (bouton retour, reset) :
  // ajustement d'état pendant le rendu, pattern recommandé par React.
  if (value !== syncedValue) {
    setSyncedValue(value)
    // Notre propre émission (value === debounced) ne doit pas écraser une saisie en cours.
    if (value !== debounced) setDraft(value)
  }

  // Propage la valeur stabilisée (sans boucle si elle est déjà à jour).
  useEffect(() => {
    if (debounced !== value) onChange(debounced)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced])

  return (
    <div className={`relative ${className}`}>
      <svg
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
      >
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" strokeLinecap="round" />
      </svg>
      <input
        type="search"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-full border border-white/70 bg-white/55 py-2 pl-9 pr-3 text-sm shadow-[inset_0_1px_2px_rgb(15_40_90/0.06)] outline-none transition placeholder:text-gray-400 focus:border-primary/50 focus:bg-white/95 focus:ring-[3px] focus:ring-primary-ring"
      />
    </div>
  )
}
