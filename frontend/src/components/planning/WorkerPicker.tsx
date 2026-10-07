import { useMemo, useState } from 'react'
import type { Worker } from '@/types'
import Avatar from '@/components/ui/Avatar'

interface WorkerPickerProps {
  workers: Worker[]
  value: number[]
  onChange: (ids: number[]) => void
  /** id → nom du chantier (ou de l'équipe) où la personne est déjà prise. */
  busy?: Map<number, string>
  /** Préfixe de la mention (« déjà sur Villa… », « déjà dans Équipe… »). */
  busyLabel?: string
  /** id → libellé d'absence (« Vacances ») : la personne est grisée (cochable quand même). */
  absent?: Map<number, string>
  disabled?: boolean
}

/** Sélecteur multiple d'ouvriers : recherche + cases cochables avec avatars. */
export default function WorkerPicker({ workers, value, onChange, busy, busyLabel = 'déjà sur', absent, disabled = false }: WorkerPickerProps) {
  const [search, setSearch] = useState('')
  const selected = useMemo(() => new Set(value), [value])

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return workers
    return workers.filter((w) => w.name.toLowerCase().includes(term) || (w.job_title ?? '').toLowerCase().includes(term))
  }, [workers, search])

  function toggle(id: number) {
    if (disabled) return
    onChange(selected.has(id) ? value.filter((v) => v !== id) : [...value, id])
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <label className="block text-sm font-medium text-gray-700">
          Équipe <span className="font-normal text-gray-400">({value.length} sélectionné{value.length > 1 ? 's' : ''})</span>
        </label>
        {value.length > 0 && !disabled && (
          <button type="button" onClick={() => onChange([])} className="text-xs text-gray-500 hover:text-gray-800">
            Tout retirer
          </button>
        )}
      </div>

      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Rechercher un nom ou un métier…"
        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm outline-none transition placeholder:text-gray-400 focus:border-primary focus:ring-2 focus:ring-primary-ring"
      />

      <ul className="max-h-60 divide-y divide-gray-100 overflow-y-auto rounded-lg border border-gray-200">
        {filtered.length === 0 && <li className="px-3 py-4 text-center text-sm text-gray-500">Aucune personne.</li>}
        {filtered.map((w) => {
          const checked = selected.has(w.id)
          const elsewhere = busy?.get(w.id)
          const away = absent?.get(w.id)
          return (
            <li key={w.id}>
              <label
                className={`flex cursor-pointer items-center gap-3 px-3 py-2 transition ${checked ? 'bg-primary-soft' : 'hover:bg-gray-50'} ${
                  disabled ? 'cursor-not-allowed opacity-60' : ''
                } ${away && !checked ? 'opacity-50 grayscale' : ''}`}
                title={away ? `Absent(e) : ${away}` : undefined}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(w.id)}
                  disabled={disabled}
                  className="h-4 w-4 rounded border-gray-300 accent-primary"
                />
                <Avatar name={w.name} color={w.color} size="md" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-gray-900">{w.name}</span>
                  <span className="block truncate text-xs text-gray-500">
                    {w.job_title ?? '—'}
                    {away && <span className="ml-1 font-medium text-red-600">· absent(e) : {away}</span>}
                    {elsewhere && (
                      <span className="ml-1 font-medium text-amber-600">
                        · {busyLabel} {elsewhere}
                      </span>
                    )}
                  </span>
                </span>
              </label>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
