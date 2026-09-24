import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useCreateAffectation, useDeleteAffectation, useUpdateAffectation } from '@/hooks/usePlanning'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { applyValidationErrors, getErrorMessage } from '@/lib/errors'
import { formatLongDay, fromKey, timesOverlap } from '@/lib/dates'
import { toast } from '@/lib/toast'
import type { Affectation, Chantier, Equipe, Worker } from '@/types'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Modal from '@/components/ui/Modal'
import Select from '@/components/ui/Select'
import Textarea from '@/components/ui/Textarea'
import WorkerPicker from '@/components/planning/WorkerPicker'

const schema = z.object({
  chantier_id: z.string().min(1, 'Choisis un chantier.'),
  equipe_id: z.string(),
  date: z.string().min(1, 'Date requise.'),
  start_time: z.string(),
  end_time: z.string(),
  note: z.string(),
})

type FormValues = z.infer<typeof schema>

/** Ce que la modale reçoit : une affectation à modifier, ou une date pour en créer une. */
export type AffectationTarget =
  | { affectation: Affectation; date?: undefined }
  | {
      affectation?: undefined
      date: string
      /** Plage sélectionnée dans le calendrier (null = journée). */
      start_time?: string | null
      end_time?: string | null
      /** Présélection d'équipe (vue « Par équipe », ligne cliquée). */
      equipeId?: number
    }

interface AffectationModalProps {
  target: AffectationTarget | null
  onClose: () => void
  chantiers: Chantier[]
  equipes: Equipe[]
  workers: Worker[]
  /** Affectations déjà chargées (pour signaler « déjà sur X » le même jour). */
  existing: Affectation[]
}

/**
 * Création / modification / suppression d'une affectation : un chantier, un
 * jour et un créneau, pour une équipe (ses membres sont pré-cochés) ou pour
 * des personnes choisies une à une.
 */
export default function AffectationModal({ target, onClose, chantiers, equipes, workers, existing }: AffectationModalProps) {
  const editing = target?.affectation ?? null
  const open = target !== null
  const create = useCreateAffectation()
  const update = useUpdateAffectation()
  const remove = useDeleteAffectation()
  const confirm = useConfirm()

  const [workerIds, setWorkerIds] = useState<number[]>([])
  const [formError, setFormError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setError,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { chantier_id: '', equipe_id: '', date: '', start_time: '07:30', end_time: '16:30', note: '' },
  })

  const membersOf = (equipeId: number | null | undefined) => equipes.find((e) => e.id === equipeId)?.members.map((m) => m.id) ?? []

  // (Ré)initialise le formulaire à chaque ouverture.
  useEffect(() => {
    if (!target) return
    setFormError(null)
    if (target.affectation) {
      const a = target.affectation
      reset({
        chantier_id: String(a.chantier_id),
        equipe_id: a.equipe_id ? String(a.equipe_id) : '',
        date: a.date,
        start_time: a.start_time ?? '',
        end_time: a.end_time ?? '',
        note: a.note ?? '',
      })
      setWorkerIds(a.workers.map((w) => w.id))
    } else {
      // Plage horaire venue du calendrier (vue Jour / Semaine) ; un clic sur un
      // jour entier (Mois, Par équipe) garde les horaires de chantier par défaut.
      const fromCalendar = target.start_time != null
      const equipeId = target.equipeId ?? (equipes.length === 1 ? equipes[0].id : undefined)
      reset({
        chantier_id: chantiers[0] ? String(chantiers[0].id) : '',
        equipe_id: equipeId ? String(equipeId) : '',
        date: target.date,
        start_time: fromCalendar ? (target.start_time ?? '') : '07:30',
        end_time: fromCalendar ? (target.end_time ?? '') : '16:30',
        note: '',
      })
      setWorkerIds(membersOf(equipeId))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, reset, chantiers, equipes])

  const date = watch('date')
  const chantierId = Number(watch('chantier_id'))
  const equipeId = Number(watch('equipe_id')) || null
  const startTime = watch('start_time') || null
  const endTime = watch('end_time') || null

  // Choisir une équipe pré-coche ses membres (modifiables ensuite).
  function onEquipeChange(value: string) {
    const id = Number(value) || null
    if (id) setWorkerIds(membersOf(id))
  }

  // Le chantier de l'affectation en cours peut être terminé (absent des chantiers ouverts) : on l'ajoute au choix.
  const options = useMemo(() => {
    if (editing && !chantiers.some((c) => c.id === editing.chantier_id)) return [editing.chantier, ...chantiers]
    return chantiers
  }, [chantiers, editing])

  // Personnes déjà affectées ailleurs sur un créneau qui chevauche celui-ci.
  const busy = useMemo(() => {
    const map = new Map<number, string>()
    const slot = { start_time: startTime, end_time: endTime }
    for (const a of existing) {
      if (a.date !== date || a.id === editing?.id || !timesOverlap(a, slot)) continue
      for (const w of a.workers) if (!map.has(w.id)) map.set(w.id, `${a.chantier.name} (${a.start_time ?? 'journée'}${a.end_time ? `–${a.end_time}` : ''})`)
    }
    return map
  }, [existing, date, editing, startTime, endTime])

  const busySelected = workerIds.filter((id) => busy.has(id))
  const team = equipes.find((e) => e.id === equipeId)
  const teamMembers = team?.members.map((m) => m.id) ?? []
  const differsFromTeam = team && (teamMembers.length !== workerIds.length || teamMembers.some((id) => !workerIds.includes(id)))

  function onSubmit(values: FormValues) {
    setFormError(null)
    const payload = {
      chantier_id: Number(values.chantier_id),
      equipe_id: Number(values.equipe_id) || null,
      date: values.date,
      start_time: values.start_time || null,
      end_time: values.end_time || null,
      note: values.note.trim() || null,
      worker_ids: workerIds,
    }
    const onSuccess = () => {
      toast(editing ? 'Affectation mise à jour.' : 'Affectation créée.', 'success')
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
    const ok = await confirm({
      title: 'Supprimer cette affectation ?',
      message: `${editing.chantier.name} · ${formatLongDay(fromKey(editing.date))}. L'équipe n'y sera plus attendue.`,
      confirmLabel: 'Supprimer',
      danger: true,
    })
    if (!ok) return
    remove.mutate(editing.id, {
      onSuccess: () => {
        toast('Affectation supprimée.', 'success')
        onClose()
      },
      onError: (err) => toast(getErrorMessage(err), 'error'),
    })
  }

  const selectedChantier = options.find((c) => c.id === chantierId)
  const pending = create.isPending || update.isPending

  return (
    <Modal open={open} onClose={onClose} title={editing ? "Modifier l'affectation" : 'Nouvelle affectation'} size="lg" dismissible={!pending}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {formError && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</p>}

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Select label="Chantier" error={errors.chantier_id?.message} {...register('chantier_id')}>
              {options.length === 0 && <option value="">Aucun chantier ouvert</option>}
              {options.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.city ? ` — ${c.city}` : ''}
                </option>
              ))}
            </Select>
            {selectedChantier && (
              <p className="mt-1.5 flex items-center gap-1.5 text-xs text-gray-500">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: selectedChantier.color }} />
                {[selectedChantier.client, selectedChantier.address, selectedChantier.city].filter(Boolean).join(' · ') || 'Sans adresse'}
              </p>
            )}
          </div>

          <div>
            <Select
              label="Équipe"
              error={errors.equipe_id?.message}
              {...register('equipe_id', { onChange: (e) => onEquipeChange(e.target.value) })}
            >
              <option value="">— Personnes choisies une à une —</option>
              {equipes.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                  {e.members.length > 1 ? ` (${e.members.length})` : ''}
                </option>
              ))}
            </Select>
            {team && (
              <p className="mt-1.5 flex items-center gap-1.5 text-xs text-gray-500">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: team.color }} />
                {team.members.map((m) => m.name).join(', ') || 'Aucun membre'}
                {differsFromTeam && <span className="text-amber-600">· équipe ajustée pour ce jour</span>}
              </p>
            )}
          </div>

          <Input label="Date" type="date" error={errors.date?.message} {...register('date')} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Début" type="time" error={errors.start_time?.message} {...register('start_time')} />
            <Input label="Fin" type="time" error={errors.end_time?.message} {...register('end_time')} />
          </div>
        </div>

        <WorkerPicker workers={workers} value={workerIds} onChange={setWorkerIds} busy={busy} />
        {busySelected.length > 0 && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
            {busySelected.length} personne{busySelected.length > 1 ? 's sont déjà affectées' : ' est déjà affectée'} ailleurs ce jour-là. Tu peux quand même valider.
          </p>
        )}

        <Textarea label="Consigne / note (optionnel)" rows={2} placeholder="Ex. prendre la remorque, clé chez le voisin…" error={errors.note?.message} {...register('note')} />

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <div>
            {editing && (
              <Button variant="ghost" className="text-red-600 hover:bg-red-50" onClick={onDelete} loading={remove.isPending}>
                Supprimer
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose} disabled={pending}>
              Annuler
            </Button>
            <Button type="submit" loading={pending} disabled={options.length === 0}>
              {editing ? 'Enregistrer' : 'Créer'}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  )
}
