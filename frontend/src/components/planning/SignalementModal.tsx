import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useCreateSignalement } from '@/hooks/useSignalements'
import { applyValidationErrors, getErrorMessage } from '@/lib/errors'
import { toast } from '@/lib/toast'
import { SIGNALEMENT_TYPES } from '@/types'
import type { Affectation } from '@/types'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Modal from '@/components/ui/Modal'
import Textarea from '@/components/ui/Textarea'

const schema = z.object({
  type: z.enum(['absence', 'fin_anticipee', 'materiel', 'autre']),
  date: z.string(),
  message: z.string().min(3, 'Décris l’imprévu en quelques mots.').max(2000),
})

type FormValues = z.infer<typeof schema>

interface SignalementModalProps {
  open: boolean
  onClose: () => void
  /** Affectation concernée (optionnel). */
  affectation?: Affectation | null
  /** Date par défaut (YYYY-MM-DD). */
  date?: string
}

const PRESETS: Record<FormValues['type'], string> = {
  absence: 'Je ne pourrai pas venir demain.',
  fin_anticipee: 'Chantier terminé plus tôt, disponible dès ',
  materiel: 'Il manque : ',
  autre: '',
}

/** « Signaler un imprévu » : un message court au bureau, sans appel téléphonique. */
export default function SignalementModal({ open, onClose, affectation, date }: SignalementModalProps) {
  const create = useCreateSignalement()
  const [formError, setFormError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    reset,
    setError,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { type: 'autre', date: '', message: '' } })
  const type = watch('type')

  useEffect(() => {
    if (!open) return
    setFormError(null)
    reset({ type: 'autre', date: affectation?.date ?? date ?? '', message: '' })
  }, [open, reset, affectation, date])

  function onSubmit(values: FormValues) {
    setFormError(null)
    create.mutate(
      { affectation_id: affectation?.id ?? null, date: values.date || null, type: values.type, message: values.message.trim() },
      {
        onSuccess: () => {
          toast('Imprévu envoyé au bureau.', 'success')
          onClose()
        },
        onError: (err) => {
          if (!applyValidationErrors(err, setError)) setFormError(getErrorMessage(err))
        },
      },
    )
  }

  return (
    <Modal open={open} onClose={onClose} title="Signaler un imprévu" size="md" dismissible={!create.isPending}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {formError && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</p>}
        {affectation && (
          <p className="text-sm text-gray-500">
            {affectation.chantier.name} · {affectation.date}
          </p>
        )}

        <div className="grid grid-cols-2 gap-2">
          {SIGNALEMENT_TYPES.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => {
                setValue('type', t.value, { shouldDirty: true })
                setValue('message', PRESETS[t.value])
              }}
              className={`rounded-lg border px-3 py-2.5 text-left text-sm font-medium transition ${
                type === t.value ? 'border-primary bg-primary-soft text-primary' : 'border-gray-200 text-gray-700 hover:bg-gray-50'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <input type="hidden" {...register('type')} />

        <Input label="Date concernée" type="date" error={errors.date?.message} {...register('date')} />
        <Textarea label="Message" rows={3} autoFocus error={errors.message?.message} {...register('message')} />

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="secondary" onClick={onClose} disabled={create.isPending}>
            Annuler
          </Button>
          <Button type="submit" loading={create.isPending}>
            Envoyer au bureau
          </Button>
        </div>
      </form>
    </Modal>
  )
}
