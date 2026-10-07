import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useAuth } from '@/auth/AuthContext'
import { useListParams } from '@/hooks/useListParams'
import { useRoles } from '@/hooks/useRoles'
import { useCreateUser, useDeleteUser, useRestoreUser, useUpdateUser, useUsers } from '@/hooks/useUsers'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { applyValidationErrors, getErrorMessage } from '@/lib/errors'
import { formatDate } from '@/lib/format'
import { toast } from '@/lib/toast'
import type { User } from '@/types'
import Avatar from '@/components/ui/Avatar'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import DataTable from '@/components/ui/DataTable'
import Input from '@/components/ui/Input'
import Modal from '@/components/ui/Modal'
import PageHeader from '@/components/ui/PageHeader'
import Pagination from '@/components/ui/Pagination'
import SearchInput from '@/components/ui/SearchInput'
import Select from '@/components/ui/Select'

const schema = z.object({
  name: z.string().min(1, 'Nom requis.'),
  email: z.string().email('Email invalide.'),
  password: z.string(),
  role: z.string().min(1, 'Rôle requis.'),
  phone: z.string().max(40),
  job_title: z.string().max(100),
  color: z.string(),
})

type FormValues = z.infer<typeof schema>

/** Couleurs d'avatar proposées pour les membres de l'équipe. */
const AVATAR_COLORS = ['#007aff', '#af52de', '#ff2d55', '#ff9500', '#34c759', '#ff3b30', '#30b0c7', '#5856d6', '#ffcc00', '#a2845e', '#64d2ff', '#1c1c1e']

const EMPTY_FORM = { name: '', email: '', password: '', role: '', phone: '', job_title: '', color: '' }

export default function UsersPage() {
  const { user: current } = useAuth()
  const { params, setPage, setSearch, setSort } = useListParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const roleFilter = searchParams.get('role') ?? ''
  const trashed = searchParams.get('trashed') === '1'

  const { data, isLoading, isFetching } = useUsers({ ...params, role: roleFilter, trashed })
  const { data: roles } = useRoles()
  const createUser = useCreateUser()
  const updateUser = useUpdateUser()
  const deleteUser = useDeleteUser()
  const restoreUser = useRestoreUser()
  const confirm = useConfirm()

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<User | null>(null)
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
    defaultValues: { ...EMPTY_FORM, role: 'ouvrier' },
  })
  const color = watch('color')

  const roleLabel = (name: string) => roles?.data.find((r) => r.name === name)?.label ?? name

  function setFilter(key: 'role' | 'trashed', value: string) {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (value) next.set(key, value)
        else next.delete(key)
        next.delete('page')
        return next
      },
      { replace: true },
    )
  }

  function openCreate() {
    setEditing(null)
    setFormError(null)
    reset({ ...EMPTY_FORM, role: roles?.default ?? 'ouvrier' })
    setModalOpen(true)
  }

  function openEdit(target: User) {
    setEditing(target)
    setFormError(null)
    reset({
      name: target.name,
      email: target.email,
      password: '',
      role: target.roles[0] ?? 'ouvrier',
      phone: target.phone ?? '',
      job_title: target.job_title ?? '',
      color: target.color ?? '',
    })
    setModalOpen(true)
  }

  function onSubmit(values: FormValues) {
    setFormError(null)
    const payload = {
      name: values.name,
      email: values.email,
      password: values.password || undefined,
      roles: [values.role],
      phone: values.phone.trim() || null,
      job_title: values.job_title.trim() || null,
      color: values.color || null,
    }
    const onSuccess = () => {
      setModalOpen(false)
      toast(editing ? 'Utilisateur mis à jour.' : 'Utilisateur créé.', 'success')
    }
    const onError = (err: unknown) => {
      if (!applyValidationErrors(err, setError)) setFormError(getErrorMessage(err))
    }

    if (editing) updateUser.mutate({ id: editing.id, payload }, { onSuccess, onError })
    else createUser.mutate(payload, { onSuccess, onError })
  }

  async function remove(target: User) {
    const ok = await confirm({
      title: `Supprimer ${target.name} ?`,
      message: 'Le compte est placé dans la corbeille : il pourra être restauré.',
      confirmLabel: 'Supprimer',
      danger: true,
    })
    if (!ok) return
    deleteUser.mutate(target.id, {
      onSuccess: () => toast('Utilisateur supprimé.', 'success'),
      onError: (err) => toast(getErrorMessage(err, 'Suppression impossible.'), 'error'),
    })
  }

  function restore(target: User) {
    restoreUser.mutate(target.id, {
      onSuccess: () => toast('Utilisateur restauré.', 'success'),
      onError: (err) => toast(getErrorMessage(err), 'error'),
    })
  }

  return (
    <div>
      <PageHeader
        title="Équipe & comptes"
        subtitle="Ouvriers, chefs de chantier et administrateurs ayant accès à l'application."
        action={<Button onClick={openCreate}>Nouveau compte</Button>}
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchInput value={params.search} onChange={setSearch} placeholder="Rechercher par nom ou email…" className="w-full sm:w-72" />
        <Select value={roleFilter} onChange={(e) => setFilter('role', e.target.value)} className="sm:w-48" aria-label="Filtrer par rôle">
          <option value="">Tous les rôles</option>
          {roles?.data.map((r) => (
            <option key={r.name} value={r.name}>
              {r.label}
            </option>
          ))}
        </Select>
        <label className="inline-flex items-center gap-2 text-sm text-gray-600">
          <input
            type="checkbox"
            checked={trashed}
            onChange={(e) => setFilter('trashed', e.target.checked ? '1' : '')}
            className="h-4 w-4 rounded border-gray-300 accent-primary"
          />
          Corbeille
        </label>
      </div>

      <Card flush>
        <DataTable
          rows={data?.data ?? []}
          rowKey={(u) => u.id}
          loading={isLoading}
          busy={isFetching}
          empty={trashed ? 'La corbeille est vide.' : 'Aucun utilisateur.'}
          sort={{ key: params.sort, dir: params.dir }}
          onSort={setSort}
          columns={[
            {
              key: 'name',
              header: 'Nom',
              sortable: true,
              render: (u) => (
                <span className="flex items-center gap-2.5">
                  <Avatar name={u.name} color={u.color} size="md" />
                  <span>
                    <span className="block font-medium text-gray-900">
                      {u.name}
                      {u.id === current?.id && <span className="ml-2 text-xs text-gray-400">(moi)</span>}
                    </span>
                    <span className="block text-xs text-gray-500">{u.job_title ?? '—'}</span>
                  </span>
                </span>
              ),
            },
            {
              key: 'email',
              header: 'Contact',
              sortable: true,
              render: (u) => (
                <span>
                  <span className="block">{u.email}</span>
                  {u.phone && <span className="block text-xs text-gray-500">{u.phone}</span>}
                </span>
              ),
            },
            {
              key: 'roles',
              header: 'Rôles',
              render: (u) => (
                <div className="flex flex-wrap gap-1">
                  {u.roles.map((r) => (
                    <Badge key={r} tone={r === 'admin' ? 'primary' : 'neutral'}>
                      {roleLabel(r)}
                    </Badge>
                  ))}
                </div>
              ),
            },
            { key: 'created_at', header: 'Créé le', sortable: true, render: (u) => formatDate(u.created_at) },
          ]}
          actions={(u) =>
            trashed ? (
              <Button variant="ghost" size="sm" onClick={() => restore(u)} loading={restoreUser.isPending}>
                Restaurer
              </Button>
            ) : (
              <>
                <Button variant="ghost" size="sm" onClick={() => openEdit(u)}>
                  Modifier
                </Button>
                {u.id !== current?.id && (
                  <Button variant="ghost" size="sm" className="text-red-600 hover:bg-red-50" onClick={() => remove(u)}>
                    Supprimer
                  </Button>
                )}
              </>
            )
          }
        />
        <Pagination meta={data?.meta} onPageChange={setPage} />
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Modifier l'utilisateur" : 'Nouvel utilisateur'}>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {formError && <p className="text-sm text-red-600">{formError}</p>}
          <Input label="Nom" error={errors.name?.message} {...register('name')} />
          <Input label="Email" type="email" error={errors.email?.message} {...register('email')} />
          <Input
            label={editing ? 'Nouveau mot de passe (optionnel)' : 'Mot de passe'}
            type="password"
            autoComplete="new-password"
            hint={editing ? 'Laisser vide pour ne pas le changer. Un nouveau mot de passe déconnecte ses appareils.' : '8 caractères minimum.'}
            error={errors.password?.message}
            {...register('password')}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Select label="Rôle" error={errors.role?.message} {...register('role')}>
              {roles?.data.map((r) => (
                <option key={r.name} value={r.name}>
                  {r.label}
                </option>
              ))}
            </Select>
            <Input label="Métier" placeholder="Maçon, grutier, chef d'équipe…" error={errors.job_title?.message} {...register('job_title')} />
            <Input label="Téléphone" type="tel" placeholder="+41 79 …" error={errors.phone?.message} {...register('phone')} />
            <div className="space-y-1">
              <p className="block text-sm font-medium text-gray-700">Couleur d'avatar</p>
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setValue('color', '', { shouldDirty: true })}
                  aria-label="Couleur automatique"
                  title="Automatique"
                  className={`flex h-6 w-6 items-center justify-center rounded-full border border-dashed border-gray-400 text-[10px] text-gray-500 ${color === '' ? 'ring-2 ring-gray-900 ring-offset-1' : ''}`}
                >
                  A
                </button>
                {AVATAR_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setValue('color', c, { shouldDirty: true })}
                    aria-label={`Couleur ${c}`}
                    className={`h-6 w-6 rounded-full transition ${color === c ? 'ring-2 ring-gray-900 ring-offset-1' : 'hover:scale-110'}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Annuler
            </Button>
            <Button type="submit" loading={createUser.isPending || updateUser.isPending}>
              {editing ? 'Enregistrer' : 'Créer'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
