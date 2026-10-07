import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useListParams } from '@/hooks/useListParams'
import { useChantiers, useCreateChantier, useDeleteChantier, useUpdateChantier } from '@/hooks/useChantiers'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { applyValidationErrors, getErrorMessage } from '@/lib/errors'
import { formatDate } from '@/lib/format'
import { toast } from '@/lib/toast'
import { CHANTIER_STATUSES } from '@/types'
import type { Chantier, ChantierStatus } from '@/types'
import type { BadgeTone } from '@/components/ui/Badge'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import EmptyState from '@/components/ui/EmptyState'
import Input from '@/components/ui/Input'
import Modal from '@/components/ui/Modal'
import PageHeader from '@/components/ui/PageHeader'
import Pagination from '@/components/ui/Pagination'
import SearchInput from '@/components/ui/SearchInput'
import Select from '@/components/ui/Select'
import Spinner from '@/components/ui/Spinner'
import Textarea from '@/components/ui/Textarea'
import AddressInput from '@/components/ui/AddressInput'
import ClientSelect from '@/components/planning/ClientSelect'

import { CHANTIER_COLORS } from '@/lib/colors'

const STATUS_TONE: Record<ChantierStatus, BadgeTone> = {
  planned: 'info',
  active: 'success',
  paused: 'warn',
  done: 'neutral',
}

const schema = z.object({
  name: z.string().min(1, 'Nom requis.').max(255),
  client: z.string().max(255),
  client_id: z.string(),
  address: z.string().max(255),
  city: z.string().max(120),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Couleur invalide.'),
  status: z.enum(['planned', 'active', 'paused', 'done']),
  start_date: z.string(),
  end_date: z.string(),
  notes: z.string().max(5000),
})

type FormValues = z.infer<typeof schema>

const EMPTY: FormValues = { name: '', client: '', client_id: '', address: '', city: '', color: CHANTIER_COLORS[0], status: 'active', start_date: '', end_date: '', notes: '' }

export default function ChantiersPage() {
  const { params, setPage, setSearch } = useListParams({ sort: 'name', dir: 'asc', per_page: 12 })
  const [searchParams, setSearchParams] = useSearchParams()
  const statusFilter = (searchParams.get('status') ?? '') as ChantierStatus | ''

  const { data, isLoading, isFetching } = useChantiers({ ...params, status: statusFilter })
  const createChantier = useCreateChantier()
  const updateChantier = useUpdateChantier()
  const deleteChantier = useDeleteChantier()
  const confirm = useConfirm()

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Chantier | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    reset,
    setError,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: EMPTY })
  const color = watch('color')
  const address = watch('address')

  function setStatusFilter(value: string) {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (value) next.set('status', value)
        else next.delete('status')
        next.delete('page')
        return next
      },
      { replace: true },
    )
  }

  function openCreate() {
    setEditing(null)
    setFormError(null)
    reset({ ...EMPTY, color: CHANTIER_COLORS[(data?.meta.total ?? 0) % CHANTIER_COLORS.length] })
    setModalOpen(true)
  }

  function openEdit(c: Chantier) {
    setEditing(c)
    setFormError(null)
    reset({
      name: c.name,
      client: c.client ?? '',
      client_id: c.client_id ? String(c.client_id) : '',
      address: c.address ?? '',
      city: c.city ?? '',
      color: c.color,
      status: c.status,
      start_date: c.start_date ?? '',
      end_date: c.end_date ?? '',
      notes: c.notes ?? '',
    })
    setModalOpen(true)
  }

  function onSubmit(values: FormValues) {
    setFormError(null)
    const payload = {
      name: values.name.trim(),
      client: values.client.trim() || null,
      client_id: Number(values.client_id) || null,
      address: values.address.trim() || null,
      city: values.city.trim() || null,
      color: values.color,
      status: values.status,
      start_date: values.start_date || null,
      end_date: values.end_date || null,
      notes: values.notes.trim() || null,
    }
    const onSuccess = () => {
      setModalOpen(false)
      toast(editing ? 'Chantier mis à jour.' : 'Chantier créé.', 'success')
    }
    const onError = (err: unknown) => {
      if (!applyValidationErrors(err, setError)) setFormError(getErrorMessage(err))
    }
    if (editing) updateChantier.mutate({ id: editing.id, payload }, { onSuccess, onError })
    else createChantier.mutate(payload, { onSuccess, onError })
  }

  async function remove(c: Chantier) {
    const ok = await confirm({
      title: `Supprimer « ${c.name} » ?`,
      message: c.affectations_count
        ? `Ce chantier a ${c.affectations_count} affectation(s) : elles disparaîtront du planning.`
        : 'Le chantier sera retiré de la liste et du planning.',
      confirmLabel: 'Supprimer',
      danger: true,
    })
    if (!ok) return
    deleteChantier.mutate(c.id, {
      onSuccess: () => toast('Chantier supprimé.', 'success'),
      onError: (err) => toast(getErrorMessage(err, 'Suppression impossible.'), 'error'),
    })
  }

  const rows = data?.data ?? []

  return (
    <div>
      <PageHeader title="Chantiers" subtitle="Les lieux d'intervention que tu places ensuite dans le planning." action={<Button onClick={openCreate}>Nouveau chantier</Button>} />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchInput value={params.search} onChange={setSearch} placeholder="Nom, client, ville…" className="w-full sm:w-72" />
        <div className="no-scrollbar flex gap-1 overflow-x-auto rounded-lg bg-gray-100 p-0.5">
          {[{ value: '', label: 'Tous' }, ...CHANTIER_STATUSES].map((s) => (
            <button
              key={s.value}
              type="button"
              onClick={() => setStatusFilter(s.value)}
              className={`whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium transition ${
                statusFilter === s.value ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <Spinner block />
      ) : rows.length === 0 ? (
        <Card>
          <EmptyState
            title={params.search || statusFilter ? 'Aucun chantier ne correspond.' : 'Aucun chantier pour l’instant.'}
            description="Crée ton premier chantier : il apparaîtra dans le sélecteur du planning."
            action={<Button onClick={openCreate}>Nouveau chantier</Button>}
          />
        </Card>
      ) : (
        <div className={`grid gap-4 sm:grid-cols-2 lg:grid-cols-3 ${isFetching ? 'opacity-70' : ''}`}>
          {rows.map((c) => (
            <article
              key={c.id}
              className="group flex flex-col overflow-hidden glass-panel rounded-card transition hover:shadow-md"
              style={{ background: `color-mix(in oklab, ${c.color} 9%, rgb(255 255 255 / 0.64))` }}
            >
              <div className="flex flex-1 flex-col p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span
                      className="h-3.5 w-3.5 shrink-0 rounded-full shadow-[inset_0_1px_0_rgb(255_255_255/0.5),0_1px_2px_rgb(0_0_0/0.15)]"
                      style={{ backgroundColor: c.color }}
                      aria-hidden
                    />
                    <div className="min-w-0">
                      <Link to={`/chantiers/${c.id}`} className="block truncate text-base font-semibold text-gray-900 hover:text-primary hover:underline">
                        {c.name}
                      </Link>
                      <p className="truncate text-sm text-gray-500">{c.client || 'Client non renseigné'}</p>
                    </div>
                  </div>
                  <Badge tone={STATUS_TONE[c.status]}>{c.status_label}</Badge>
                </div>

                <dl className="mt-3 space-y-1 text-sm text-gray-600">
                  <div className="flex items-start gap-2">
                    <svg className="mt-0.5 shrink-0 text-gray-400" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11Z" />
                      <circle cx="12" cy="10" r="2.5" />
                    </svg>
                    <dd className="truncate">{[c.address, c.city].filter(Boolean).join(', ') || '—'}</dd>
                  </div>
                  <div className="flex items-center gap-2">
                    <svg className="shrink-0 text-gray-400" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="5" width="18" height="16" rx="2" />
                      <path d="M3 10h18M8 3v4M16 3v4" />
                    </svg>
                    <dd>
                      {c.start_date || c.end_date ? `${formatDate(c.start_date)} → ${formatDate(c.end_date)}` : 'Dates non définies'}
                    </dd>
                  </div>
                </dl>

                <div className="mt-4 flex items-center justify-between border-t border-black/[0.06] pt-3">
                  <Link to={`/planning?chantier=${c.id}`} className="text-xs font-medium text-primary hover:underline">
                    {c.affectations_count ?? 0} jour{(c.affectations_count ?? 0) > 1 ? 's' : ''} planifié{(c.affectations_count ?? 0) > 1 ? 's' : ''}
                  </Link>
                  <div className="flex gap-1">
                    <Link to={`/chantiers/${c.id}`} className="inline-flex items-center rounded-lg px-2.5 py-1.5 text-xs font-medium text-primary transition hover:bg-primary-soft">
                      Fiche
                    </Link>
                    <Button variant="ghost" size="sm" onClick={() => openEdit(c)}>
                      Modifier
                    </Button>
                    <Button variant="ghost" size="sm" className="text-red-600 hover:bg-red-50" onClick={() => remove(c)}>
                      Supprimer
                    </Button>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      <div className="mt-4">
        <Pagination meta={data?.meta} onPageChange={setPage} />
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Modifier le chantier' : 'Nouveau chantier'} size="lg">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {formError && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</p>}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Input label="Nom du chantier" placeholder="Ex. Villa Les Cèdres" error={errors.name?.message} {...register('name')} />
            </div>
            <ClientSelect
              value={watch('client_id')}
              onChange={(id, client) => {
                setValue('client_id', id, { shouldDirty: true })
                if (client) setValue('client', client.name, { shouldDirty: true })
              }}
              error={errors.client_id?.message}
            />
            <Select label="Statut" error={errors.status?.message} {...register('status')}>
              {CHANTIER_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </Select>
            <AddressInput
              value={address}
              onChange={(v) => setValue('address', v, { shouldDirty: true })}
              onPick={(s) => {
                setValue('address', s.street, { shouldDirty: true })
                if (s.city) setValue('city', s.city, { shouldDirty: true })
              }}
              error={errors.address?.message}
            />
            <Input label="Ville" error={errors.city?.message} {...register('city')} />
            <Input label="Début" type="date" error={errors.start_date?.message} {...register('start_date')} />
            <Input label="Fin prévue" type="date" error={errors.end_date?.message} {...register('end_date')} />
          </div>

          <div className="space-y-1.5">
            <p className="block text-sm font-medium text-gray-700">Couleur dans le calendrier</p>
            <div className="flex flex-wrap items-center gap-2">
              {CHANTIER_COLORS.map((c) => (
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

          <Textarea label="Notes (accès, contacts, consignes…)" rows={3} error={errors.notes?.message} {...register('notes')} />

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Annuler
            </Button>
            <Button type="submit" loading={createChantier.isPending || updateChantier.isPending}>
              {editing ? 'Enregistrer' : 'Créer'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
