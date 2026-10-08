import { useEffect, useId, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useAllClients, useCreateClient } from '@/hooks/useClients'
import { applyValidationErrors, getErrorMessage } from '@/lib/errors'
import { toast } from '@/lib/toast'
import type { Client } from '@/types'
import AddressInput from '@/components/ui/AddressInput'
import Button from '@/components/ui/Button'
import Input, { FIELD_CLASS, FIELD_ERROR, FIELD_OK, LABEL_CLASS } from '@/components/ui/Input'
import Modal from '@/components/ui/Modal'

const schema = z.object({
  name: z.string().min(1, 'Nom requis.').max(255),
  contact_name: z.string().max(255),
  phone: z.string().max(40),
  email: z.string().max(255),
  address: z.string().max(255),
  city: z.string().max(120),
})

type FormValues = z.infer<typeof schema>

interface ClientSelectProps {
  /** Id du client sous forme de chaîne ('' = aucun). */
  value: string
  onChange: (id: string, client: Client | null) => void
  error?: string
  label?: string
  /** Peut créer un client (planificateurs). */
  canCreate?: boolean
}

/** Comparaison sans accents ni casse (« dubois » trouve « Dubois Claire »). */
function norm(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
}

function clientLabel(c: Client): string {
  return c.city ? `${c.name} — ${c.city}` : c.name
}

/**
 * Sélection du client d'un chantier : un champ de recherche (les premières lettres
 * suffisent, nom, ville ou contact), flèches + Entrée au clavier, et création
 * rapide (« + » ou « Créer le client … ») sans quitter la fiche.
 */
export default function ClientSelect({ value, onChange, error, label = 'Client', canCreate = true }: ClientSelectProps) {
  const { data: clients = [] } = useAllClients()
  const create = useCreateClient()
  const [open, setOpen] = useState(false)
  const [prefill, setPrefill] = useState('')
  const [created, setCreated] = useState<Client[]>([])
  const [formError, setFormError] = useState<string | null>(null)

  // Recherche.
  const [query, setQuery] = useState('')
  const [listOpen, setListOpen] = useState(false)
  const [active, setActive] = useState(0)
  const boxRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listId = useId()

  const options = [...clients, ...created.filter((c) => !clients.some((o) => o.id === c.id))].sort((a, b) => a.name.localeCompare(b.name))
  const selected = options.find((c) => String(c.id) === value) ?? null
  const q = norm(query.trim())
  const filtered = q ? options.filter((c) => norm([c.name, c.city, c.contact_name].filter(Boolean).join(' ')).includes(q)) : options
  const exact = q !== '' && options.some((c) => norm(c.name) === q)
  const canOffer = canCreate && q !== '' && !exact
  const total = filtered.length + (canOffer ? 1 : 0)

  // Fermeture au clic en dehors.
  useEffect(() => {
    if (!listOpen) return
    function onDown(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setListOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [listOpen])

  function pick(c: Client | null) {
    onChange(c ? String(c.id) : '', c)
    setQuery('')
    setListOpen(false)
  }

  function openCreate(name = '') {
    setPrefill(name)
    setListOpen(false)
    setOpen(true)
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!listOpen && (e.key === 'ArrowDown' || e.key === 'Enter')) {
      setListOpen(true)
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((i) => (total ? (i + 1) % total : 0))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => (total ? (i - 1 + total) % total : 0))
    } else if (e.key === 'Enter') {
      if (!listOpen) return
      e.preventDefault()
      if (active < filtered.length) pick(filtered[active])
      else if (canOffer) openCreate(query.trim())
    } else if (e.key === 'Escape') {
      setListOpen(false)
      setQuery('')
    } else if (e.key === 'Backspace' && query === '' && selected) {
      pick(null)
    }
  }

  const {
    register,
    handleSubmit,
    reset,
    setError,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { name: '', contact_name: '', phone: '', email: '', address: '', city: '' } })
  const address = watch('address')

  useEffect(() => {
    if (open) {
      setFormError(null)
      reset({ name: prefill, contact_name: '', phone: '', email: '', address: '', city: '' })
    }
  }, [open, prefill, reset])

  function onSubmit(values: FormValues) {
    setFormError(null)
    create.mutate(
      {
        name: values.name.trim(),
        contact_name: values.contact_name.trim() || null,
        phone: values.phone.trim() || null,
        email: values.email.trim() || null,
        address: values.address.trim() || null,
        city: values.city.trim() || null,
        notes: null,
      },
      {
        onSuccess: (client) => {
          setCreated((prev) => [...prev, client])
          onChange(String(client.id), client)
          toast(`Client « ${client.name} » créé.`, 'success')
          setOpen(false)
        },
        onError: (err) => {
          if (!applyValidationErrors(err, setError)) setFormError(getErrorMessage(err))
        },
      },
    )
  }

  // Ce que montre le champ : la saisie pendant la recherche, sinon le client choisi.
  const display = listOpen ? query : selected ? clientLabel(selected) : ''

  return (
    <div>
      <div className="flex items-end gap-2">
        <div ref={boxRef} className="relative min-w-0 flex-1 space-y-1">
          <label htmlFor={`${listId}-input`} className={LABEL_CLASS}>
            {label}
          </label>
          <div className="relative">
            <svg className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" strokeLinecap="round" />
            </svg>
            <input
              ref={inputRef}
              id={`${listId}-input`}
              type="text"
              role="combobox"
              aria-expanded={listOpen}
              aria-controls={listId}
              aria-autocomplete="list"
              autoComplete="off"
              value={display}
              placeholder={selected ? clientLabel(selected) : 'Tape les premières lettres du client…'}
              onFocus={() => {
                setQuery('')
                setActive(0)
                setListOpen(true)
              }}
              onChange={(e) => {
                setQuery(e.target.value)
                setActive(0)
                setListOpen(true)
              }}
              onKeyDown={onKeyDown}
              className={`${FIELD_CLASS} ${error ? FIELD_ERROR : FIELD_OK} pl-9 ${selected && !listOpen ? 'pr-9 font-medium' : ''}`}
            />
            {selected && !listOpen && (
              <button
                type="button"
                onClick={() => pick(null)}
                aria-label="Retirer le client"
                title="Retirer le client"
                className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-gray-400 transition hover:bg-gray-900/[0.06] hover:text-gray-700"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6">
                  <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" />
                </svg>
              </button>
            )}

            {listOpen && (
              <ul id={listId} role="listbox" className="glass-strong pc-pop absolute left-0 right-0 top-full z-30 mt-1.5 max-h-72 overflow-y-auto rounded-2xl p-1.5">
                {filtered.length === 0 && !canOffer && <li className="px-3 py-2 text-sm text-gray-500">{options.length === 0 ? 'Aucun client pour l’instant.' : 'Aucun client ne correspond.'}</li>}
                {filtered.map((c, i) => {
                  const isActive = i === active
                  const isSelected = c.id === selected?.id
                  return (
                    <li key={c.id} role="option" aria-selected={isSelected}>
                      <button
                        type="button"
                        onMouseEnter={() => setActive(i)}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => pick(c)}
                        className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition ${isActive ? 'bg-primary text-white' : 'text-gray-800'}`}
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{c.name}</span>
                          {(c.city || c.contact_name || c.phone) && (
                            <span className={`block truncate text-xs ${isActive ? 'text-white/80' : 'text-gray-500'}`}>
                              {[c.city, c.contact_name, c.phone].filter(Boolean).join(' · ')}
                            </span>
                          )}
                        </span>
                        {isSelected && (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" aria-hidden>
                            <path d="m5 12 5 5L20 7" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </button>
                    </li>
                  )
                })}
                {canOffer && (
                  <li role="option" aria-selected={active === filtered.length}>
                    <button
                      type="button"
                      onMouseEnter={() => setActive(filtered.length)}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => openCreate(query.trim())}
                      className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-medium transition ${
                        active === filtered.length ? 'bg-primary text-white' : 'text-primary'
                      }`}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" aria-hidden>
                        <path d="M12 5v14M5 12h14" strokeLinecap="round" />
                      </svg>
                      Créer le client « {query.trim()} »
                    </button>
                  </li>
                )}
              </ul>
            )}
          </div>
          {error && <p className="text-[13px] text-sys-red">{error}</p>}
        </div>
        {canCreate && (
          <button
            type="button"
            onClick={() => openCreate('')}
            aria-label="Nouveau client"
            title="Créer un nouveau client"
            className={`glass-pill flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full text-gray-700 active:scale-95 ${error ? 'mb-6' : ''}`}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 5v14M5 12h14" strokeLinecap="round" />
            </svg>
          </button>
        )}
      </div>
      {selected && (selected.phone || selected.contact_name) && (
        <p className="mt-1 text-xs text-gray-500">{[selected.contact_name, selected.phone, selected.email].filter(Boolean).join(' · ')}</p>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Nouveau client" size="md" dismissible={!create.isPending}>
        <form
          onSubmit={(e) => {
            e.stopPropagation()
            void handleSubmit(onSubmit)(e)
          }}
          className="space-y-4"
        >
          {formError && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</p>}
          <Input label="Nom du client" placeholder="Famille Roulet, Régie Lémanique SA…" autoFocus error={errors.name?.message} {...register('name')} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Personne de contact" error={errors.contact_name?.message} {...register('contact_name')} />
            <Input label="Téléphone" type="tel" placeholder="+41 79 …" error={errors.phone?.message} {...register('phone')} />
          </div>
          <Input label="Email" type="email" error={errors.email?.message} {...register('email')} />
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <AddressInput
                value={address}
                onChange={(v) => setValue('address', v, { shouldDirty: true })}
                onPick={(s) => {
                  setValue('address', s.street, { shouldDirty: true })
                  if (s.city) setValue('city', s.city, { shouldDirty: true })
                }}
                error={errors.address?.message}
              />
            </div>
            <Input label="Ville" error={errors.city?.message} {...register('city')} />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={create.isPending}>
              Annuler
            </Button>
            <Button type="submit" loading={create.isPending}>
              Créer et sélectionner
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
