import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useAllClients, useCreateClient } from '@/hooks/useClients'
import { applyValidationErrors, getErrorMessage } from '@/lib/errors'
import { toast } from '@/lib/toast'
import type { Client } from '@/types'
import AddressInput from '@/components/ui/AddressInput'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Modal from '@/components/ui/Modal'
import Select from '@/components/ui/Select'

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

/**
 * Sélection du client d'un chantier, avec création rapide (« + ») sans quitter
 * la fiche : nom, contact, téléphone, adresse. Le client créé est sélectionné.
 */
export default function ClientSelect({ value, onChange, error, label = 'Client', canCreate = true }: ClientSelectProps) {
  const { data: clients = [] } = useAllClients()
  const create = useCreateClient()
  const [open, setOpen] = useState(false)
  const [created, setCreated] = useState<Client[]>([])
  const [formError, setFormError] = useState<string | null>(null)

  const options = [...clients, ...created.filter((c) => !clients.some((o) => o.id === c.id))].sort((a, b) => a.name.localeCompare(b.name))

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
      reset({ name: '', contact_name: '', phone: '', email: '', address: '', city: '' })
    }
  }, [open, reset])

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

  const selected = options.find((c) => String(c.id) === value)

  return (
    <div>
      <div className="flex items-end gap-2">
        <div className="min-w-0 flex-1">
          <Select label={label} value={value} onChange={(e) => onChange(e.target.value, options.find((c) => String(c.id) === e.target.value) ?? null)} error={error}>
            <option value="">— Aucun client —</option>
            {options.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.city ? ` — ${c.city}` : ''}
              </option>
            ))}
          </Select>
        </div>
        {canCreate && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Nouveau client"
            title="Créer un nouveau client"
            className={`flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-600 transition hover:border-primary hover:bg-primary-soft hover:text-primary ${error ? 'mb-6' : ''}`}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 5v14M5 12h14" strokeLinecap="round" />
            </svg>
          </button>
        )}
      </div>
      {selected && (selected.phone || selected.contact_name) && (
        <p className="mt-1 text-xs text-gray-500">
          {[selected.contact_name, selected.phone, selected.email].filter(Boolean).join(' · ')}
        </p>
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
