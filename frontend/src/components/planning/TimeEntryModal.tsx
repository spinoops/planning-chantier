import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useCreateTimeEntry, useDeleteTimeEntry, useUpdateTimeEntry } from '@/hooks/useTimeEntries'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { applyValidationErrors, getErrorMessage } from '@/lib/errors'
import { formatLongDay, fromKey } from '@/lib/dates'
import { formatMinutes } from '@/lib/format'
import { toast } from '@/lib/toast'
import type { Affectation, Chantier, TimeEntry } from '@/types'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Modal from '@/components/ui/Modal'
import Select from '@/components/ui/Select'
import Textarea from '@/components/ui/Textarea'

const schema = z.object({
  chantier_id: z.string(),
  date: z.string().min(1, 'Date requise.'),
  start_time: z.string().min(1, 'Heure de début requise.'),
  end_time: z.string().min(1, 'Heure de fin requise.'),
  break_minutes: z.string(),
  comment: z.string().max(1000),
})

type FormValues = z.infer<typeof schema>

/** Ouverture : depuis une affectation (pré-remplie), une saisie libre pour un jour, ou une entrée à modifier. */
export type TimeEntryTarget =
  | { entry: TimeEntry; affectation?: undefined; date?: undefined }
  | { entry?: undefined; affectation: Affectation; date?: undefined }
  | { entry?: undefined; affectation?: undefined; date: string }

interface TimeEntryModalProps {
  target: TimeEntryTarget | null
  onClose: () => void
  /** Chantiers proposés pour une saisie libre. */
  chantiers: Chantier[]
  /** Planificateur : pointage pour une autre personne. */
  userId?: number
  /** Nom de cette personne (titre de la fenêtre). */
  personName?: string
}

function minutesBetween(start: string, end: string, pause: number): number {
  if (!start || !end) return 0
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  return Math.max(0, eh * 60 + em - (sh * 60 + sm) - (pause || 0))
}

/**
 * Pointage des heures d'une journée : les heures planifiées servent de
 * proposition, l'employé corrige, ajoute la pause et un commentaire.
 */
export default function TimeEntryModal({ target, onClose, chantiers, userId, personName }: TimeEntryModalProps) {
  const open = target !== null
  const editing = target?.entry ?? null
  const create = useCreateTimeEntry()
  const update = useUpdateTimeEntry()
  const remove = useDeleteTimeEntry()
  const confirm = useConfirm()
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
    defaultValues: { chantier_id: '', date: '', start_time: '', end_time: '', break_minutes: '0', comment: '' },
  })

  useEffect(() => {
    if (!target) return
    setFormError(null)
    if (target.entry) {
      const e = target.entry
      reset({ chantier_id: e.chantier_id ? String(e.chantier_id) : '', date: e.date, start_time: e.start_time, end_time: e.end_time, break_minutes: String(e.break_minutes), comment: e.comment ?? '' })
    } else if (target.affectation) {
      const a = target.affectation
      const long = a.planned_minutes >= 360
      reset({
        chantier_id: String(a.chantier_id),
        date: a.date,
        start_time: a.start_time ?? '07:30',
        end_time: a.end_time ?? '16:45',
        break_minutes: long ? '45' : '0',
        comment: '',
      })
    } else {
      reset({ chantier_id: chantiers[0] ? String(chantiers[0].id) : '', date: target.date, start_time: '07:30', end_time: '16:45', break_minutes: '45', comment: '' })
    }
  }, [target, reset, chantiers])

  const start = watch('start_time')
  const end = watch('end_time')
  const pause = Number(watch('break_minutes')) || 0
  const total = minutesBetween(start, end, pause)
  const affectation = target?.affectation
  const planned = affectation?.planned_minutes ?? 0
  const lockedChantier = Boolean(affectation)

  function onSubmit(values: FormValues) {
    setFormError(null)
    const payload = {
      user_id: userId,
      affectation_id: affectation?.id ?? editing?.affectation_id ?? null,
      chantier_id: Number(values.chantier_id) || null,
      date: values.date,
      start_time: values.start_time,
      end_time: values.end_time,
      break_minutes: Number(values.break_minutes) || 0,
      comment: values.comment.trim() || null,
    }
    const onSuccess = () => {
      toast(editing ? 'Heures mises à jour.' : 'Heures enregistrées.', 'success')
      onClose()
    }
    const onError = (err: unknown) => {
      if (!applyValidationErrors(err, setError)) setFormError(getErrorMessage(err))
    }
    if (editing) update.mutate({ id: editing.id, payload }, { onSuccess, onError })
    else create.mutate(payload, { onSuccess, onError })
  }

  async function onDelete() {
    if (!editing) return
    const ok = await confirm({ title: 'Supprimer ces heures ?', confirmLabel: 'Supprimer', danger: true })
    if (!ok) return
    remove.mutate(editing.id, {
      onSuccess: () => {
        toast('Heures supprimées.', 'success')
        onClose()
      },
      onError: (err) => toast(getErrorMessage(err), 'error'),
    })
  }

  const pending = create.isPending || update.isPending
  const who = personName ? ` · ${personName}` : ''
  const title = editing ? (personName ? `Heures de ${personName}` : 'Modifier mes heures') : affectation ? `Pointer · ${affectation.chantier.name}${who}` : `Pointer des heures${who}`
  const dateLabel = target && !target.entry ? formatLongDay(fromKey(target.affectation?.date ?? target.date ?? '')) : null

  return (
    <Modal open={open} onClose={onClose} title={title} size="md" dismissible={!pending}>
      <form
        onSubmit={handleSubmit(onSubmit)}
        onKeyDown={(e) => {
          if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') void handleSubmit(onSubmit)()
        }}
        className="space-y-4"
      >
        {formError && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</p>}
        {dateLabel && <p className="text-sm text-gray-500">{dateLabel}</p>}

        {lockedChantier ? (
          <input type="hidden" {...register('chantier_id')} />
        ) : (
          <Select label="Chantier" error={errors.chantier_id?.message} {...register('chantier_id')}>
            <option value="">— Sans chantier —</option>
            {chantiers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        )}
        {!affectation && !editing ? <Input label="Date" type="date" error={errors.date?.message} {...register('date')} /> : <input type="hidden" {...register('date')} />}

        <div className="grid grid-cols-3 gap-3">
          <Input label="Début" type="time" error={errors.start_time?.message} {...register('start_time')} />
          <Input label="Fin" type="time" error={errors.end_time?.message} {...register('end_time')} />
          <Input label="Pause (min)" type="number" min={0} max={480} step={15} error={errors.break_minutes?.message} {...register('break_minutes')} />
        </div>

        <div className="flex flex-wrap gap-2">
          {[0, 30, 45, 60].map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setValue('break_minutes', String(p), { shouldDirty: true })}
              className={`rounded-full border px-2.5 py-1 text-xs font-medium transition ${pause === p ? 'border-primary bg-primary-soft text-primary' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
            >
              {p === 0 ? 'Sans pause' : `${p} min`}
            </button>
          ))}
        </div>

        <div className="flex items-baseline justify-between rounded-lg bg-gray-50 px-3 py-2">
          <span className="text-sm text-gray-600">Total travaillé</span>
          <span className="text-lg font-semibold tabular-nums text-gray-900">
            {formatMinutes(total)}
            {planned > 0 && total !== planned && (
              <span className={`ml-2 text-xs font-medium ${total > planned ? 'text-amber-600' : 'text-gray-500'}`}>
                ({total > planned ? '+' : '−'}
                {formatMinutes(Math.abs(total - planned))} vs planifié)
              </span>
            )}
          </span>
        </div>

        <Textarea label="Commentaire (optionnel)" rows={2} placeholder="Ex. attente livraison 30 min, fini plus tôt…" error={errors.comment?.message} {...register('comment')} />

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <div>
            {editing && editing.status !== 'validated' && (
              <Button variant="ghost" className="text-red-600 hover:bg-red-50" onClick={onDelete} loading={remove.isPending}>
                Supprimer
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose} disabled={pending}>
              Annuler
            </Button>
            <Button type="submit" loading={pending}>
              {editing ? 'Enregistrer' : 'Pointer'}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  )
}
