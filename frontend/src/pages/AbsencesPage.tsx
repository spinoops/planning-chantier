import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useAbsences, useCreateAbsence, useDeleteAbsence, useUpdateAbsence } from '@/hooks/useAbsences'
import { useWorkers } from '@/hooks/useWorkers'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { applyValidationErrors, getErrorMessage } from '@/lib/errors'
import { addDays, toKey, todayKey } from '@/lib/dates'
import { formatDate } from '@/lib/format'
import { toast } from '@/lib/toast'
import { ABSENCE_TYPES } from '@/types'
import type { Absence } from '@/types'
import Avatar from '@/components/ui/Avatar'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import EmptyState from '@/components/ui/EmptyState'
import Input from '@/components/ui/Input'
import Modal from '@/components/ui/Modal'
import PageHeader from '@/components/ui/PageHeader'
import Select from '@/components/ui/Select'
import Spinner from '@/components/ui/Spinner'

const schema = z.object({
  user_id: z.string().min(1, 'Choisis une personne.'),
  start_date: z.string().min(1, 'Date requise.'),
  end_date: z.string().min(1, 'Date requise.'),
  type: z.enum(['vacances', 'maladie', 'ecole', 'autre']),
  note: z.string().max(255),
})

type FormValues = z.infer<typeof schema>

const TONE: Record<Absence['type'], 'info' | 'danger' | 'warn' | 'neutral'> = { vacances: 'info', maladie: 'danger', ecole: 'warn', autre: 'neutral' }

/** Absences : vacances, maladie, école. Les absents sont grisés dans le planning. */
export default function AbsencesPage() {
  const range = useMemo(() => ({ from: toKey(addDays(new Date(), -30)), to: toKey(addDays(new Date(), 120)) }), [])
  const { data: absences = [], isLoading } = useAbsences(range)
  const { data: workers = [] } = useWorkers()
  const create = useCreateAbsence()
  const update = useUpdateAbsence()
  const remove = useDeleteAbsence()
  const confirm = useConfirm()

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Absence | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { user_id: '', start_date: '', end_date: '', type: 'vacances', note: '' } })

  function openCreate() {
    setEditing(null)
    setFormError(null)
    reset({ user_id: '', start_date: todayKey(), end_date: todayKey(), type: 'vacances', note: '' })
    setModalOpen(true)
  }

  function openEdit(a: Absence) {
    setEditing(a)
    setFormError(null)
    reset({ user_id: String(a.user_id), start_date: a.start_date, end_date: a.end_date, type: a.type, note: a.note ?? '' })
    setModalOpen(true)
  }

  function onSubmit(values: FormValues) {
    setFormError(null)
    const payload = { user_id: Number(values.user_id), start_date: values.start_date, end_date: values.end_date, type: values.type, note: values.note.trim() || null }
    const onSuccess = () => {
      setModalOpen(false)
      toast(editing ? 'Absence mise à jour.' : 'Absence enregistrée.', 'success')
    }
    const onError = (err: unknown) => {
      if (!applyValidationErrors(err, setError)) setFormError(getErrorMessage(err))
    }
    if (editing) update.mutate({ id: editing.id, payload }, { onSuccess, onError })
    else create.mutate(payload, { onSuccess, onError })
  }

  async function onDelete(a: Absence) {
    const ok = await confirm({ title: 'Supprimer cette absence ?', confirmLabel: 'Supprimer', danger: true })
    if (!ok) return
    remove.mutate(a.id, { onSuccess: () => toast('Absence supprimée.', 'success'), onError: (err) => toast(getErrorMessage(err), 'error') })
  }

  const today = todayKey()
  const upcoming = absences.filter((a) => a.end_date >= today)
  const past = absences.filter((a) => a.end_date < today)

  const list = (items: Absence[]) => (
    <ul className="divide-y divide-gray-100">
      {items.map((a) => (
        <li key={a.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
          {a.user && <Avatar name={a.user.name} color={a.user.color} size="md" />}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-gray-900">{a.user?.name}</p>
            <p className="text-xs text-gray-500">
              {a.start_date === a.end_date ? formatDate(a.start_date) : `${formatDate(a.start_date)} → ${formatDate(a.end_date)}`}
              {a.note && <span className="italic"> · {a.note}</span>}
            </p>
          </div>
          <Badge tone={TONE[a.type]}>{a.type_label}</Badge>
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" onClick={() => openEdit(a)}>
              Modifier
            </Button>
            <Button variant="ghost" size="sm" className="text-red-600 hover:bg-red-50" onClick={() => onDelete(a)}>
              Supprimer
            </Button>
          </div>
        </li>
      ))}
    </ul>
  )

  return (
    <div>
      <PageHeader title="Absences" action={<Button onClick={openCreate}>Nouvelle absence</Button>} />

      {isLoading ? (
        <Spinner block />
      ) : (
        <div className="space-y-6">
          <Card title="À venir et en cours" flush>
            {upcoming.length ? list(upcoming) : <EmptyState title="Aucune absence à venir." action={<Button onClick={openCreate}>Nouvelle absence</Button>} />}
          </Card>
          {past.length > 0 && (
            <Card title="Passées (30 derniers jours)" flush>
              {list(past)}
            </Card>
          )}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Modifier l'absence" : 'Nouvelle absence'} size="md">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {formError && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</p>}
          <Select label="Personne" error={errors.user_id?.message} {...register('user_id')}>
            <option value="">— Choisir —</option>
            {workers.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </Select>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Du" type="date" error={errors.start_date?.message} {...register('start_date')} />
            <Input label="Au" type="date" error={errors.end_date?.message} {...register('end_date')} />
          </div>
          <Select label="Type" error={errors.type?.message} {...register('type')}>
            {ABSENCE_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </Select>
          <Input label="Note (optionnel)" error={errors.note?.message} {...register('note')} />
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Annuler
            </Button>
            <Button type="submit" loading={create.isPending || update.isPending}>
              {editing ? 'Enregistrer' : 'Créer'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
