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
import Input from '@/components/ui/Input'
import Modal from '@/components/ui/Modal'

const schema = z.object({
  name: z.string().min(1, 'Nom requis.').max(255),
  client: z.string().max(255),
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
    defaultValues: { name: '', client: '', address: '', city: '', color: CHANTIER_COLORS[0] },
  })
  const color = watch('color')

  useEffect(() => {
    if (!open) return
    setFormError(null)
    reset({ name: '', client: '', address: '', city: '', color: nextColor(CHANTIER_COLORS, existing.map((c) => c.color)) })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, reset])

  function onSubmit(values: FormValues) {
    setFormError(null)
    create.mutate(
      {
        name: values.name.trim(),
        client: values.client.trim() || values.name.trim(),
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

        <Input label="Nom du chantier (client)" placeholder="Ex. Joray François" autoFocus error={errors.name?.message} {...register('name')} />
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <Input label="Adresse" placeholder="Rue des Pèlerins 35" error={errors.address?.message} {...register('address')} />
          </div>
          <Input label="Ville" placeholder="Porrentruy" error={errors.city?.message} {...register('city')} />
        </div>
        <Input label="Client (si différent du nom)" placeholder="Optionnel" error={errors.client?.message} {...register('client')} />

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

        <p className="text-xs text-gray-500">Le chantier est créé « en cours ». Dates, notes et statut se complètent dans la page Chantiers.</p>

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
