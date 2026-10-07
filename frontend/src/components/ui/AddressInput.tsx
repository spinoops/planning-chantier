import { useEffect, useRef, useState } from 'react'
import { useDebounce } from '@/hooks/useDebounce'
import Input from '@/components/ui/Input'

interface Suggestion {
  label: string
  street: string
  city: string
}

interface AddressInputProps {
  label?: string
  value: string
  onChange: (value: string) => void
  /** Appelé avec la rue et la localité quand l'utilisateur choisit une proposition. */
  onPick?: (s: Suggestion) => void
  error?: string
  placeholder?: string
}

/**
 * Champ d'adresse avec propositions de la Confédération (api3.geo.admin.ch,
 * gratuit, sans clé). Hors ligne ou en cas d'erreur, le champ reste une saisie libre.
 */
export default function AddressInput({ label = 'Adresse', value, onChange, onPick, error, placeholder }: AddressInputProps) {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<Suggestion[]>([])
  const debounced = useDebounce(value ?? '', 300)
  const boxRef = useRef<HTMLDivElement>(null)
  const pickedRef = useRef<string | null>(null)
  /** Vrai dès que l'utilisateur a tapé : une valeur posée par le formulaire (reset) ne déclenche pas de recherche. */
  const typedRef = useRef(false)

  useEffect(() => {
    const q = debounced.trim()
    if (!typedRef.current || q.length < 4 || q === pickedRef.current || typeof navigator !== 'undefined' && navigator.onLine === false) {
      setItems([])
      return
    }
    const ctrl = new AbortController()
    const url = `https://api3.geo.admin.ch/rest/services/api/SearchServer?searchText=${encodeURIComponent(q)}&type=locations&origins=address&limit=6&sr=4326`
    fetch(url, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((json: { results?: { attrs: { label: string; detail: string } }[] }) => {
        const list = (json.results ?? []).map((r) => parseLabel(r.attrs.label, r.attrs.detail)).filter((s): s is Suggestion => Boolean(s))
        setItems(list)
        setOpen(list.length > 0)
      })
      .catch(() => setItems([]))
    return () => ctrl.abort()
  }, [debounced])

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [])

  return (
    <div ref={boxRef} className="relative">
      <Input
        label={label}
        value={value}
        onChange={(e) => {
          pickedRef.current = null
          typedRef.current = true
          onChange(e.target.value)
        }}
        onFocus={() => items.length > 0 && setOpen(true)}
        placeholder={placeholder ?? 'Rue et numéro'}
        autoComplete="off"
        error={error}
      />
      {open && items.length > 0 && (
        <ul className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
          {items.map((s, i) => (
            <li key={`${s.label}-${i}`}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  pickedRef.current = s.street
                  onChange(s.street)
                  onPick?.(s)
                  setOpen(false)
                }}
                className="flex w-full flex-col px-3 py-1.5 text-left hover:bg-gray-50"
              >
                <span className="text-sm text-gray-900">{s.street}</span>
                <span className="text-xs text-gray-500">{s.city}</span>
              </button>
            </li>
          ))}
          <li className="px-3 pt-1 text-[10px] text-gray-400">Adresses : geo.admin.ch</li>
        </ul>
      )}
    </div>
  )
}

/** « <b>Rue des Pèlerins 35</b> 2900 Porrentruy » → rue + localité. */
function parseLabel(label: string, detail: string): Suggestion | null {
  const text = label.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
  const m = text.match(/^(.*?)\s+(\d{4})\s+(.+)$/)
  if (m) return { label: text, street: m[1].trim(), city: m[3].trim() }
  // Repli sur `detail` (« rue des pelerins 35 2900 porrentruy 6800 porrentruy ju »)
  const d = detail.match(/^(.*?)\s+(\d{4})\s+(\S+)/)
  if (d) return { label: text, street: capitalizeWords(d[1]), city: capitalizeWords(d[3]) }
  return text ? { label: text, street: text, city: '' } : null
}

function capitalizeWords(s: string): string {
  return s.replace(/\b\p{L}/gu, (c) => c.toUpperCase())
}
