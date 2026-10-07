import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useCreateChantier } from '@/hooks/useChantiers'
import { applyValidationErrors, getErrorMessage } from '@/lib/errors'
import { CHANTIER_COLORS, nextColor } from '@/lib/colors'
import { toast } from '@/lib/toast'
import type { Chantier } from '@/types'
import Button from '@/components/ui/Button'
import AddressInput from '@/components/ui/AddressInput'
import Input from '@/components/ui/Input'
import Modal from '@/components/ui/Modal'
import ChantierTitleFields from '@/components/planning/ChantierTitleFields'
import { buildChantierName } from '@/lib/chantierName'

const schema = z.object({
  complement: z.string().max(255),
  client: z.string().max(255),
  client_id: z.string(),
  address: z.string().max(255),
  city: z.string().max(120),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Couleur invalide.'),
})

type FormValues = z.infer<typeof schema>

interface QuickChantierModalProps {
  open: boolean
  onClose: () => void
  /** Appelé avec le chantier créé (pour le sélectionner dans le formulaire parent). */
  onCreated: (chantier: Chantier) => void
  /** Chantiers existants : sert à choisir une couleur pas encore utilisée. */
  existing: Chantier[]
}

/**
 * Création rapide d'un chantier depuis la modale d'affectation : juste le nom
 * (client), l'adresse et la ville. Statut « en cours », le reste se complète
 * plus tard dans la page Chantiers.
 */
export default function QuickChantierModal({ open, onClose, onCreated, existing }: QuickChantierModalProps) {
  const create = useCreateChantier()
  const [formError, setFormError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    reset,
    setError,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { complement: '', client: '', client_id: '', address: '', city: '', color: CHANTIER_COLORS[0] },
  })
  const color = watch('color')
  const address = watch('address')

  useEffect(() => {
    if (!open) return
    setFormError(null)
    reset({ complement: '', client: '', client_id: '', address: '', city: '', color: nextColor(CHANTIER_COLORS, existing.map((c) => c.color)) })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, reset])

  function onSubmit(values: FormValues) {
    setFormError(null)
    const name = buildChantierName(values.client, values.complement)
    if (!name) {
      setError('complement', { message: 'Choisis un client ou saisis un titre.' })
      return
    }
    create.mutate(
      {
        name,
        client: values.client.trim() || null,
        client_id: Number(values.client_id) || null,
        address: values.address.trim() || null,
        city: values.city.trim() || null,
        color: values.color,
        status: 'active',
        start_date: null,
        end_date: null,
        notes: null,
      },
      {
        onSuccess: (chantier) => {
          toast(`Chantier « ${chantier.name} » créé.`, 'success')
          onCreated(chantier)
          onClose()
        },
        onError: (err) => {
          if (!applyValidationErrors(err, setError)) setFormError(getErrorMessage(err))
        },
      },
    )
  }

  return (
    <Modal open={open} onClose={onClose} title="Nouveau chantier" size="md" dismissible={!create.isPending}>
      <form
        onSubmit={(e) => {
          // Ne pas remonter la soumission au formulaire de l'affectation (portail : pas imbriqué dans le DOM, mais on isole par sûreté).
          e.stopPropagation()
          void handleSubmit(onSubmit)(e)
        }}
        className="space-y-4"
      >
        {formError && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</p>}

        <ChantierTitleFields
          clientId={watch('client_id')}
          clientName={watch('client')}
          complement={watch('complement')}
          onClient={(id, client) => {
            setValue('client_id', id, { shouldDirty: true })
            setValue('client', client?.name ?? '', { shouldDirty: true })
            // Adresse du client reprise si le chantier n'en a pas encore.
            if (client && !watch('address') && client.address) {
              setValue('address', client.address, { shouldDirty: true })
              if (client.city) setValue('city', client.city, { shouldDirty: true })
            }
          }}
          onComplement={(v) => setValue('complement', v, { shouldDirty: true, shouldValidate: Boolean(errors.complement) })}
          clientError={errors.client_id?.message}
          complementError={errors.complement?.message}
        />
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <AddressInput
              value={address}
              onChange={(v) => setValue('address', v, { shouldDirty: true })}
              onPick={(s) => {
                setValue('address', s.street, { shouldDirty: true })
                if (s.city) setValue('city', s.city, { shouldDirty: true })
              }}
              placeholder="Rue des Pèlerins 35"
              error={errors.address?.message}
            />
          </div>
          <Input label="Ville" placeholder="Porrentruy" error={errors.city?.message} {...register('city')} />
        </div>
        <input type="hidden" {...register('client')} />

        <div className="space-y-1.5">
          <p className="block text-sm font-medium text-gray-700">Couleur</p>
          <div className="flex flex-wrap items-center gap-2">
            {CHANTIER_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setValue('color', c, { shouldDirty: true })}
                aria-label={`Couleur ${c}`}
                className={`h-6 w-6 rounded-full transition ${color === c ? 'ring-2 ring-gray-900 ring-offset-2' : 'hover:scale-110'}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
          {errors.color && <p className="text-sm text-red-600">{errors.color.message}</p>}
        </div>

        <p className="text-xs text-gray-500">Le chantier est créé « en cours ». Dates, matériel, devis et remarques se complètent dans sa fiche.</p>

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="secondary" onClick={onClose} disabled={create.isPending}>
            Annuler
          </Button>
          <Button type="submit" loading={create.isPending}>
            Créer et sélectionner
          </Button>
        </div>
      </form>
    </Modal>
  )
}
