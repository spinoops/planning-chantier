import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useCreateEquipe, useDeleteEquipe, useEquipes, useUpdateEquipe } from '@/hooks/useEquipes'
import { useWorkers } from '@/hooks/useWorkers'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { applyValidationErrors, getErrorMessage } from '@/lib/errors'
import { todayKey } from '@/lib/dates'
import { formatDate } from '@/lib/format'
import { toast } from '@/lib/toast'
import type { Equipe } from '@/types'
import Avatar from '@/components/ui/Avatar'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import EmptyState from '@/components/ui/EmptyState'
import Input from '@/components/ui/Input'
import Modal from '@/components/ui/Modal'
import PageHeader from '@/components/ui/PageHeader'
import Spinner from '@/components/ui/Spinner'
import WorkerPicker from '@/components/planning/WorkerPicker'

/** Palette des équipes (couleurs de calendrier, lisibles en fond clair). */
const TEAM_COLORS = ['#ff3b30', '#ffcc00', '#34c759', '#007aff', '#af52de', '#ff9500', '#30b0c7', '#ff2d55', '#00c7be', '#5856d6', '#a2845e', '#8e8e93']

const schema = z.object({
  name: z.string().min(1, 'Nom requis.').max(100),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Couleur invalide.'),
  /** Vide = équipe permanente ; sinon date après laquelle l'équipe disparaît du planning. */
  expires_at: z.string(),
})

type FormValues = z.infer<typeof schema>

/**
 * Gestion des équipes : chaque employé appartient à une équipe (souvent lui
 * seul). Le planning se fait par équipe : sa couleur teinte ses affectations.
 */
export default function EquipesPage() {
  const { data: equipes = [], isLoading } = useEquipes(true)
  const { data: workers = [] } = useWorkers()
  const createEquipe = useCreateEquipe()
  const updateEquipe = useUpdateEquipe()
  const deleteEquipe = useDeleteEquipe()
  const confirm = useConfirm()

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Equipe | null>(null)
  const [memberIds, setMemberIds] = useState<number[]>([])
  const [formError, setFormError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    reset,
    setError,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { name: '', color: TEAM_COLORS[0], expires_at: '' } })
  const color = watch('color')

  // Employés déjà dans une autre équipe (affiché dans le sélecteur).
  const busy = useMemo(() => {
    const map = new Map<number, string>()
    for (const e of equipes) {
      if (e.id === editing?.id) continue
      for (const m of e.members) map.set(m.id, e.name)
    }
    return map
  }, [equipes, editing])

  const unassigned = useMemo(() => workers.filter((w) => !w.equipe_id), [workers])

  useEffect(() => {
    if (!modalOpen) setEditing(null)
  }, [modalOpen])

  function openCreate(prefill?: { name: string; memberIds: number[] }) {
    setEditing(null)
    setFormError(null)
    reset({ name: prefill?.name ?? '', color: TEAM_COLORS[equipes.length % TEAM_COLORS.length], expires_at: '' })
    setMemberIds(prefill?.memberIds ?? [])
    setModalOpen(true)
  }

  function openEdit(e: Equipe) {
    setEditing(e)
    setFormError(null)
    reset({ name: e.name, color: e.color, expires_at: e.expires_at ?? '' })
    setMemberIds(e.members.map((m) => m.id))
    setModalOpen(true)
  }

  function onSubmit(values: FormValues) {
    setFormError(null)
    const payload = { name: values.name.trim(), color: values.color, expires_at: values.expires_at || null, member_ids: memberIds }
    const onSuccess = () => {
      setModalOpen(false)
      toast(editing ? 'Équipe mise à jour.' : 'Équipe créée.', 'success')
    }
    const onError = (err: unknown) => {
      if (!applyValidationErrors(err, setError)) setFormError(getErrorMessage(err))
    }
    if (editing) updateEquipe.mutate({ id: editing.id, payload }, { onSuccess, onError })
    else createEquipe.mutate(payload, { onSuccess, onError })
  }

  async function remove(e: Equipe) {
    const ok = await confirm({
      title: `Supprimer l'équipe « ${e.name} » ?`,
      message: 'Ses membres deviennent « sans équipe ». Les affectations déjà planifiées gardent leurs ouvriers.',
      confirmLabel: 'Supprimer',
      danger: true,
    })
    if (!ok) return
    deleteEquipe.mutate(e.id, {
      onSuccess: () => toast('Équipe supprimée.', 'success'),
      onError: (err) => toast(getErrorMessage(err, 'Suppression impossible.'), 'error'),
    })
  }

  return (
    <div>
      <PageHeader
        title="Équipes"
        subtitle="Le planning se fait par équipe : une personne seule ou un binôme, chacune avec sa couleur dans le calendrier."
        action={<Button onClick={() => openCreate()}>Nouvelle équipe</Button>}
      />

      {isLoading ? (
        <Spinner block />
      ) : equipes.length === 0 ? (
        <Card>
          <EmptyState
            title="Aucune équipe pour l'instant."
            description="Crée une équipe par employé (ou par binôme) : tu pourras ensuite la placer sur les chantiers."
            action={<Button onClick={() => openCreate()}>Nouvelle équipe</Button>}
          />
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {equipes.map((e) => (
            <article key={e.id} className="flex flex-col overflow-hidden glass-panel rounded-card transition hover:shadow-md">
              <div className="h-1.5" style={{ backgroundColor: e.color }} />
              <div className="flex flex-1 flex-col p-4">
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full" style={{ backgroundColor: e.color }} />
                  <h3 className="truncate text-base font-semibold text-gray-900">{e.name}</h3>
                  {e.expires_at && (
                    <span className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${e.expires_at < todayKey() ? 'bg-gray-100 text-gray-500' : 'bg-amber-50 text-amber-700'}`}>
                      {e.expires_at < todayKey() ? 'expirée' : `jusqu'au ${formatDate(e.expires_at)}`}
                    </span>
                  )}
                  <span className="ml-auto text-xs text-gray-400">{e.affectations_count ?? 0} affectation{(e.affectations_count ?? 0) > 1 ? 's' : ''}</span>
                </div>
                {e.members.length === 0 ? (
                  <p className="mt-3 text-sm italic text-gray-400">Aucun membre.</p>
                ) : (
                  <ul className="mt-3 space-y-2">
                    {e.members.map((m) => (
                      <li key={m.id} className="flex items-center gap-2.5">
                        <Avatar name={m.name} color={m.color} size="md" />
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium text-gray-900">{m.name}</span>
                          <span className="block truncate text-xs text-gray-500">{m.job_title ?? '—'}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="mt-4 flex justify-end gap-1 border-t border-gray-100 pt-3">
                  <Button variant="ghost" size="sm" onClick={() => openEdit(e)}>
                    Modifier
                  </Button>
                  <Button variant="ghost" size="sm" className="text-red-600 hover:bg-red-50" onClick={() => remove(e)}>
                    Supprimer
                  </Button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {unassigned.length > 0 && (
        <Card title="Sans équipe" description="Ces employés ne peuvent pas encore être planifiés par équipe." className="mt-6">
          <ul className="flex flex-wrap gap-2">
            {unassigned.map((w) => (
              <li key={w.id}>
                <button
                  type="button"
                  onClick={() => openCreate({ name: w.name.split(' ')[0], memberIds: [w.id] })}
                  className="inline-flex items-center gap-2 rounded-full border border-dashed border-gray-300 py-1 pl-1 pr-3 text-sm text-gray-700 transition hover:border-primary hover:bg-primary-soft hover:text-primary"
                  title="Créer une équipe individuelle"
                >
                  <Avatar name={w.name} color={w.color} size="sm" />
                  {w.name}
                  <span className="text-xs text-gray-400">+ équipe</span>
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Modifier l'équipe" : 'Nouvelle équipe'} size="lg">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          {formError && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</p>}

          <Input label="Nom de l'équipe" placeholder="Ex. Robin, Étienne & David…" error={errors.name?.message} {...register('name')} />

          <div className="space-y-1.5">
            <p className="block text-sm font-medium text-gray-700">Couleur dans le calendrier</p>
            <div className="flex flex-wrap items-center gap-2">
              {TEAM_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setValue('color', c, { shouldDirty: true })}
                  aria-label={`Couleur ${c}`}
                  className={`h-7 w-7 rounded-full transition ${color === c ? 'ring-2 ring-gray-900 ring-offset-2' : 'hover:scale-110'}`}
                  style={{ backgroundColor: c }}
                />
              ))}
              <label className="ml-1 inline-flex cursor-pointer items-center gap-1.5 text-xs text-gray-500">
                <input type="color" value={color} onChange={(e) => setValue('color', e.target.value, { shouldDirty: true })} className="h-7 w-9 cursor-pointer rounded border border-gray-300 bg-white p-0.5" />
                Autre
              </label>
            </div>
            {errors.color && <p className="text-sm text-red-600">{errors.color.message}</p>}
          </div>

          <Input
            label="Équipe temporaire jusqu'au (optionnel)"
            type="date"
            hint="Pour un binôme d'une semaine : l'équipe disparaît du planning après cette date, ses affectations restent."
            error={errors.expires_at?.message}
            {...register('expires_at')}
          />

          <WorkerPicker workers={workers} value={memberIds} onChange={setMemberIds} busy={busy} busyLabel="déjà dans" />
          <p className="text-xs text-gray-500">Un employé n'appartient qu'à une équipe : le cocher ici le retire de son équipe actuelle.</p>

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Annuler
            </Button>
            <Button type="submit" loading={createEquipe.isPending || updateEquipe.isPending}>
              {editing ? 'Enregistrer' : 'Créer'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
