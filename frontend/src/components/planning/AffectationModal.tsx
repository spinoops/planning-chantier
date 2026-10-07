import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useAuth } from '@/auth/AuthContext'
import { isAbsentOn } from '@/hooks/useAbsences'
import { useCreateAffectation, useDeleteAffectation, useUpdateAffectation } from '@/hooks/usePlanning'
import { useSettings } from '@/hooks/useSettings'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { applyValidationErrors, getErrorMessage } from '@/lib/errors'
import { addDays, formatLongDay, fromKey, timesOverlap, toKey } from '@/lib/dates'
import { toast } from '@/lib/toast'
import type { Absence, Affectation, Chantier, Equipe, Worker } from '@/types'
import Avatar from '@/components/ui/Avatar'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Modal from '@/components/ui/Modal'
import Select from '@/components/ui/Select'
import Textarea from '@/components/ui/Textarea'
import PhotoGallery from '@/components/planning/PhotoGallery'
import QuickChantierModal from '@/components/planning/QuickChantierModal'
import WorkerPicker from '@/components/planning/WorkerPicker'

const schema = z.object({
  chantier_id: z.string().min(1, 'Choisis un chantier.'),
  equipe_id: z.string(),
  date: z.string().min(1, 'Date requise.'),
  start_time: z.string(),
  end_time: z.string(),
  phase: z.string().max(100),
  note: z.string(),
  repeat: z.boolean(),
  repeat_until: z.string(),
})

type FormValues = z.infer<typeof schema>

const LAST_CHANTIER_KEY = 'planning_last_chantier'
const WEEKDAYS = [
  { iso: 1, label: 'L' },
  { iso: 2, label: 'M' },
  { iso: 3, label: 'M' },
  { iso: 4, label: 'J' },
  { iso: 5, label: 'V' },
  { iso: 6, label: 'S' },
  { iso: 7, label: 'D' },
]

/** Ce que la modale reçoit : une affectation à modifier, ou une date pour en créer une. */
export type AffectationTarget =
  | { affectation: Affectation; date?: undefined }
  | {
      affectation?: undefined
      date: string
      /** Plage sélectionnée dans le calendrier (null = journée). */
      start_time?: string | null
      end_time?: string | null
      /** Présélection d'équipe (vue « Par équipe », ligne cliquée, ou équipe déposée). */
      equipeId?: number
      /** Présélection de chantier (vue « Par chantier », ligne cliquée). */
      chantierId?: number
      /** Personnes présélectionnées (personne déposée depuis la colonne de gauche). */
      workerIds?: number[]
    }

interface AffectationModalProps {
  target: AffectationTarget | null
  onClose: () => void
  chantiers: Chantier[]
  equipes: Equipe[]
  workers: Worker[]
  /** Affectations déjà chargées (pour signaler « déjà sur X » le même jour). */
  existing: Affectation[]
  /** Absences de la période (les absents sont grisés). */
  absences?: Absence[]
}

function readLastChantier(): number | null {
  try {
    return Number(localStorage.getItem(LAST_CHANTIER_KEY)) || null
  } catch {
    return null
  }
}

/**
 * Création / modification / suppression d'une affectation : un chantier, un
 * jour et un créneau (boutons Matin / Après-midi / Journée), pour une équipe
 * (ses membres sont pré-cochés) ou des personnes choisies une à une, un
 * passage du patron / chef, une phase, et à la création une répétition.
 */
export default function AffectationModal({ target, onClose, chantiers, equipes, workers, existing, absences = [] }: AffectationModalProps) {
  const { user } = useAuth()
  const { data: settings } = useSettings()
  const editing = target?.affectation ?? null
  const open = target !== null
  const create = useCreateAffectation()
  const update = useUpdateAffectation()
  const remove = useDeleteAffectation()
  const confirm = useConfirm()

  const [workerIds, setWorkerIds] = useState<number[]>([])
  const [visitorIds, setVisitorIds] = useState<number[]>([])
  const [repeatDays, setRepeatDays] = useState<number[]>([1, 2, 3, 4, 5])
  const [formError, setFormError] = useState<string | null>(null)
  const [quickOpen, setQuickOpen] = useState(false)
  const [created, setCreated] = useState<Chantier[]>([])
  const [showPhotos, setShowPhotos] = useState(false)

  const hours = {
    morning: [settings?.planning_morning_start ?? '07:30', settings?.planning_morning_end ?? '12:00'] as const,
    afternoon: [settings?.planning_afternoon_start ?? '13:00', settings?.planning_afternoon_end ?? '16:45'] as const,
  }

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setError,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { chantier_id: '', equipe_id: '', date: '', start_time: hours.morning[0], end_time: hours.afternoon[1], phase: '', note: '', repeat: false, repeat_until: '' },
  })

  const membersOf = (equipeId: number | null | undefined) => equipes.find((e) => e.id === equipeId)?.members.map((m) => m.id) ?? []

  // (Ré)initialise le formulaire à chaque ouverture.
  useEffect(() => {
    if (!target) return
    setFormError(null)
    setShowPhotos(false)
    setRepeatDays([1, 2, 3, 4, 5])
    if (target.affectation) {
      const a = target.affectation
      reset({
        chantier_id: String(a.chantier_id),
        equipe_id: a.equipe_id ? String(a.equipe_id) : '',
        date: a.date,
        start_time: a.start_time ?? '',
        end_time: a.end_time ?? '',
        phase: a.phase ?? '',
        note: a.note ?? '',
        repeat: false,
        repeat_until: '',
      })
      setWorkerIds(a.workers.map((w) => w.id))
      setVisitorIds(a.visitors.map((v) => v.id))
    } else {
      // Plage horaire venue du calendrier (vue Jour / Semaine) ; un clic sur un
      // jour entier (Mois, Par équipe) garde les horaires de chantier par défaut.
      const fromCalendar = target.start_time != null
      const equipeId = target.workerIds ? undefined : (target.equipeId ?? (equipes.length === 1 ? equipes[0].id : undefined))
      const last = target.chantierId ?? readLastChantier()
      const defaultChantier = chantiers.find((c) => c.id === last) ?? chantiers[0]
      reset({
        chantier_id: defaultChantier ? String(defaultChantier.id) : '',
        equipe_id: equipeId ? String(equipeId) : '',
        date: target.date,
        start_time: fromCalendar ? (target.start_time ?? '') : hours.morning[0],
        end_time: fromCalendar ? (target.end_time ?? '') : hours.afternoon[1],
        phase: '',
        note: '',
        repeat: false,
        repeat_until: toKey(addDays(fromKey(target.date), 4)),
      })
      setWorkerIds(target.workerIds ?? membersOf(equipeId))
      setVisitorIds([])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, reset, chantiers, equipes])

  const date = watch('date')
  const chantierId = Number(watch('chantier_id'))
  const equipeId = Number(watch('equipe_id')) || null
  const startTime = watch('start_time') || null
  const endTime = watch('end_time') || null
  const repeat = watch('repeat')

  function onEquipeChange(value: string) {
    const id = Number(value) || null
    if (id) setWorkerIds(membersOf(id))
  }

  function setSlot(start: string, end: string) {
    setValue('start_time', start, { shouldDirty: true })
    setValue('end_time', end, { shouldDirty: true })
  }

  // Le chantier de l'affectation en cours peut être terminé (absent des chantiers ouverts) : on l'ajoute au choix.
  const options = useMemo(() => {
    const list = [...chantiers, ...created.filter((c) => !chantiers.some((o) => o.id === c.id))]
    if (editing && !list.some((c) => c.id === editing.chantier_id)) return [editing.chantier, ...list]
    return list
  }, [chantiers, created, editing])

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

  // Absents ce jour-là.
  const absent = useMemo(() => {
    const map = new Map<number, string>()
    if (!date) return map
    for (const w of workers) {
      const ab = isAbsentOn(absences, w.id, date)
      if (ab) map.set(w.id, ab.type_label)
    }
    return map
  }, [absences, workers, date])

  const busySelected = workerIds.filter((id) => busy.has(id))
  const absentSelected = workerIds.filter((id) => absent.has(id))
  const team = equipes.find((e) => e.id === equipeId)
  const teamMembers = team?.members.map((m) => m.id) ?? []
  const differsFromTeam = team && (teamMembers.length !== workerIds.length || teamMembers.some((id) => !workerIds.includes(id)))

  // Candidats au « passage » : chefs / planificateurs qui ne sont pas déjà dans l'équipe cochée.
  const visitorCandidates = workers.filter((w) => (w.roles ?? []).some((r) => r === 'chef' || r === 'admin') && !workerIds.includes(w.id))

  function onSubmit(values: FormValues) {
    setFormError(null)
    const payload = {
      chantier_id: Number(values.chantier_id),
      equipe_id: Number(values.equipe_id) || null,
      date: values.date,
      start_time: values.start_time || null,
      end_time: values.end_time || null,
      phase: values.phase.trim() || null,
      note: values.note.trim() || null,
      worker_ids: workerIds,
      visitor_ids: visitorIds,
      ...(editing || !values.repeat ? {} : { repeat_until: values.repeat_until || null, repeat_days: repeatDays }),
    }
    try {
      localStorage.setItem(LAST_CHANTIER_KEY, String(payload.chantier_id))
    } catch {
      // ignore
    }
    const onSuccess = (res: unknown) => {
      const count = (res as { created?: number } | null)?.created
      toast(editing ? 'Affectation mise à jour.' : count && count > 1 ? `${count} affectations créées.` : 'Affectation créée.', 'success')
      onClose()
    }
    const onError = (err: unknown) => {
      if (!applyValidationErrors(err, setError)) setFormError(getErrorMessage(err))
    }
    if (editing) {
      update.mutate({ id: editing.id, payload }, { onSuccess, onError })
      return
    }

    // Un calendrier par chantier : si ce chantier a déjà une carte sur ce jour et ce créneau,
    // on y ajoute les personnes au lieu de créer une deuxième carte identique.
    const twin = values.repeat
      ? undefined
      : existing.find(
          (a) =>
            a.chantier.id === payload.chantier_id &&
            a.date === payload.date &&
            (a.start_time ?? null) === payload.start_time &&
            (a.end_time ?? null) === payload.end_time,
        )
    if (twin) {
      const mergedWorkers = [...new Set([...twin.workers.map((w) => w.id), ...workerIds])]
      const mergedVisitors = [...new Set([...(twin.visitors ?? []).map((v) => v.id), ...visitorIds])].filter((id) => !mergedWorkers.includes(id))
      update.mutate(
        {
          id: twin.id,
          payload: {
            worker_ids: mergedWorkers,
            visitor_ids: mergedVisitors,
            ...(twin.equipe ? {} : { equipe_id: payload.equipe_id }),
            ...(twin.note || !payload.note ? {} : { note: payload.note }),
            ...(twin.phase || !payload.phase ? {} : { phase: payload.phase }),
          },
        },
        {
          onSuccess: () => {
            toast(`Ajouté à l'affectation existante de ${twin.chantier.name}.`, 'success')
            onClose()
          },
          onError,
        },
      )
      return
    }
    create.mutate(payload, { onSuccess, onError })
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
  const slotIs = (s: readonly [string, string]) => startTime === s[0] && endTime === s[1]
  const dayIs = startTime === hours.morning[0] && endTime === hours.afternoon[1]

  return (
    <Modal open={open} onClose={onClose} title={editing ? "Modifier l'affectation" : 'Nouvelle affectation'} size="lg" dismissible={!pending && !quickOpen}>
      <form
        onSubmit={handleSubmit(onSubmit)}
        onKeyDown={(e) => {
          if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') void handleSubmit(onSubmit)()
        }}
        className="space-y-5"
      >
        {formError && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</p>}

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <div className="flex items-end gap-2">
              <div className="min-w-0 flex-1">
                <Select label="Chantier" error={errors.chantier_id?.message} {...register('chantier_id')}>
                  {options.length === 0 && <option value="">Aucun chantier ouvert</option>}
                  {options.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                      {c.city ? ` — ${c.city}` : ''}
                    </option>
                  ))}
                </Select>
              </div>
              <button
                type="button"
                onClick={() => setQuickOpen(true)}
                aria-label="Nouveau chantier"
                title="Créer un nouveau chantier"
                className={`flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-600 transition hover:border-primary hover:bg-primary-soft hover:text-primary ${
                  errors.chantier_id ? 'mb-6' : ''
                }`}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M12 5v14M5 12h14" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            {selectedChantier && (
              <p className="mt-1.5 flex items-center gap-1.5 text-xs text-gray-500">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: selectedChantier.color }} />
                {[selectedChantier.client !== selectedChantier.name ? selectedChantier.client : null, selectedChantier.address, selectedChantier.city].filter(Boolean).join(' · ') || 'Sans adresse'}
                <Link to={`/chantiers/${selectedChantier.id}`} className="ml-auto font-medium text-primary hover:underline" onClick={onClose}>
                  Fiche
                </Link>
              </p>
            )}
          </div>

          <div>
            <Select label="Équipe" error={errors.equipe_id?.message} {...register('equipe_id', { onChange: (e) => onEquipeChange(e.target.value) })}>
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
          <div>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Début" type="time" error={errors.start_time?.message} {...register('start_time')} />
              <Input label="Fin" type="time" error={errors.end_time?.message} {...register('end_time')} />
            </div>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {[
                { label: 'Matin', s: hours.morning, active: slotIs(hours.morning) },
                { label: 'Après-midi', s: hours.afternoon, active: slotIs(hours.afternoon) },
                { label: 'Journée', s: [hours.morning[0], hours.afternoon[1]] as const, active: dayIs },
              ].map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => setSlot(p.s[0], p.s[1])}
                  className={`rounded-full border px-2.5 py-0.5 text-xs font-medium transition ${p.active ? 'border-primary bg-primary-soft text-primary' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                >
                  {p.label} <span className="opacity-60">{p.s[0]}–{p.s[1]}</span>
                </button>
              ))}
              <button
                type="button"
                onClick={() => setSlot('', '')}
                className={`rounded-full border px-2.5 py-0.5 text-xs font-medium transition ${!startTime && !endTime ? 'border-primary bg-primary-soft text-primary' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
              >
                Sans horaire
              </button>
            </div>
          </div>
        </div>

        <WorkerPicker workers={workers} value={workerIds} onChange={setWorkerIds} busy={busy} absent={absent} />
        {busySelected.length > 0 && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
            {busySelected.length} personne{busySelected.length > 1 ? 's sont déjà affectées' : ' est déjà affectée'} ailleurs sur ce créneau. Tu peux quand même valider.
          </p>
        )}
        {absentSelected.length > 0 && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
            {absentSelected.length} personne{absentSelected.length > 1 ? 's cochées sont absentes' : ' cochée est absente'} ce jour-là.
          </p>
        )}

        {visitorCandidates.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-sm font-medium text-gray-700">
              Passage <span className="font-normal text-gray-400">(contrôle, métrés : lié sans faire partie de l'équipe)</span>
            </p>
            <div className="flex flex-wrap gap-2">
              {visitorCandidates.map((v) => {
                const on = visitorIds.includes(v.id)
                return (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => setVisitorIds((prev) => (on ? prev.filter((id) => id !== v.id) : [...prev, v.id]))}
                    className={`inline-flex items-center gap-1.5 rounded-full border py-0.5 pl-0.5 pr-2.5 text-xs font-medium transition ${
                      on ? 'border-primary bg-primary-soft text-primary' : 'border-gray-200 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <Avatar name={v.name} color={v.color} size="xs" />
                    {v.name.split(' ')[0]}
                    {v.id === user?.id && <span className="opacity-60">(moi)</span>}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Étape (optionnel)" placeholder="Ex. Gros œuvre, Finitions…" error={errors.phase?.message} {...register('phase')} />
          <Textarea label="Consigne / note (optionnel)" rows={1} placeholder="Ex. prendre la remorque, clé chez le voisin…" error={errors.note?.message} {...register('note')} />
        </div>

        {!editing && (
          <div className="rounded-lg border border-gray-200 p-3">
            <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-gray-700">
              <input type="checkbox" className="h-4 w-4 rounded border-gray-300 accent-primary" {...register('repeat')} />
              Répéter
            </label>
            {repeat && (
              <div className="mt-3 flex flex-wrap items-end gap-4">
                <div className="flex items-end gap-1">
                  {WEEKDAYS.map((d) => {
                    const on = repeatDays.includes(d.iso)
                    return (
                      <button
                        key={d.iso}
                        type="button"
                        aria-label={`Jour ${d.iso}`}
                        onClick={() => setRepeatDays((prev) => (on ? prev.filter((x) => x !== d.iso) : [...prev, d.iso].sort()))}
                        className={`h-8 w-8 rounded-full text-xs font-semibold transition ${on ? 'bg-primary text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                      >
                        {d.label}
                      </button>
                    )
                  })}
                </div>
                <div className="w-44">
                  <Input label="Jusqu'au" type="date" error={errors.repeat_until?.message} {...register('repeat_until')} />
                </div>
                <p className="pb-2 text-xs text-gray-500">Même chantier, horaire et équipe chaque jour coché (90 jours max).</p>
              </div>
            )}
          </div>
        )}

        {editing && (
          <div>
            <button type="button" onClick={() => setShowPhotos((v) => !v)} className="text-sm font-medium text-primary hover:underline">
              {showPhotos ? 'Masquer les photos' : `Photos${editing.photos_count ? ` (${editing.photos_count})` : ''}`}
            </button>
            {showPhotos && (
              <div className="mt-2 rounded-lg border border-gray-200 p-3">
                <PhotoGallery affectationId={editing.id} />
              </div>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <div>
            {editing && (
              <Button variant="ghost" className="text-red-600 hover:bg-red-50" onClick={onDelete} loading={remove.isPending}>
                Supprimer
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden text-[11px] text-gray-400 sm:inline">Ctrl + Entrée pour valider</span>
            <Button variant="secondary" onClick={onClose} disabled={pending}>
              Annuler
            </Button>
            <Button type="submit" loading={pending} disabled={options.length === 0}>
              {editing ? 'Enregistrer' : repeat ? 'Créer la série' : 'Créer'}
            </Button>
          </div>
        </div>
      </form>

      <QuickChantierModal
        open={quickOpen}
        onClose={() => setQuickOpen(false)}
        existing={options}
        onCreated={(chantier) => {
          setCreated((prev) => [...prev, chantier])
          setValue('chantier_id', String(chantier.id), { shouldDirty: true, shouldValidate: true })
        }}
      />
    </Modal>
  )
}
