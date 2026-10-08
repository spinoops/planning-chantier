import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useClients, useCreateClient, useDeleteClient, useUpdateClient } from '@/hooks/useClients'
import { useListParams } from '@/hooks/useListParams'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { applyValidationErrors, getErrorMessage } from '@/lib/errors'
import { toast } from '@/lib/toast'
import type { Client } from '@/types'
import AddressInput from '@/components/ui/AddressInput'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import DataTable from '@/components/ui/DataTable'
import Input from '@/components/ui/Input'
import Modal from '@/components/ui/Modal'
import PageHeader from '@/components/ui/PageHeader'
import Pagination from '@/components/ui/Pagination'
import SearchInput from '@/components/ui/SearchInput'
import Textarea from '@/components/ui/Textarea'

const schema = z.object({
  name: z.string().min(1, 'Nom requis.').max(255),
  contact_name: z.string().max(255),
  phone: z.string().max(40),
  email: z.string().max(255),
  address: z.string().max(255),
  city: z.string().max(120),
  notes: z.string().max(5000),
})

type FormValues = z.infer<typeof schema>
const EMPTY: FormValues = { name: '', contact_name: '', phone: '', email: '', address: '', city: '', notes: '' }

/** Clients (donneurs d'ordre) : sélectionnés à la création d'un chantier. */
export default function ClientsPage() {
  const { params, setPage, setSearch, setSort } = useListParams({ sort: 'name', dir: 'asc' })
  const { data, isLoading, isFetching } = useClients(params)
  const create = useCreateClient()
  const update = useUpdateClient()
  const remove = useDeleteClient()
  const confirm = useConfirm()

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Client | null>(null)
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
  const address = watch('address')

  function openCreate() {
    setEditing(null)
    setFormError(null)
    reset(EMPTY)
    setModalOpen(true)
  }

  function openEdit(c: Client) {
    setEditing(c)
    setFormError(null)
    reset({ name: c.name, contact_name: c.contact_name ?? '', phone: c.phone ?? '', email: c.email ?? '', address: c.address ?? '', city: c.city ?? '', notes: c.notes ?? '' })
    setModalOpen(true)
  }

  function onSubmit(values: FormValues) {
    setFormError(null)
    const payload = {
      name: values.name.trim(),
      contact_name: values.contact_name.trim() || null,
      phone: values.phone.trim() || null,
      email: values.email.trim() || null,
      address: values.address.trim() || null,
      city: values.city.trim() || null,
      notes: values.notes.trim() || null,
    }
    const onSuccess = () => {
      setModalOpen(false)
      toast(editing ? 'Client mis à jour.' : 'Client créé.', 'success')
    }
    const onError = (err: unknown) => {
      if (!applyValidationErrors(err, setError)) setFormError(getErrorMessage(err))
    }
    if (editing) update.mutate({ id: editing.id, payload }, { onSuccess, onError })
    else create.mutate(payload, { onSuccess, onError })
  }

  async function onDelete(c: Client) {
    const ok = await confirm({
      title: `Supprimer « ${c.name} » ?`,
      message: c.chantiers_count ? `Ce client a ${c.chantiers_count} chantier(s) : ils restent, sans client rattaché.` : 'Le client sera retiré de la liste.',
      confirmLabel: 'Supprimer',
      danger: true,
    })
    if (!ok) return
    remove.mutate(c.id, { onSuccess: () => toast('Client supprimé.', 'success'), onError: (err) => toast(getErrorMessage(err, 'Suppression impossible.'), 'error') })
  }

  return (
    <div>
      <PageHeader title="Clients" action={<Button onClick={openCreate}>Nouveau client</Button>} />

      <div className="mb-4">
        <SearchInput value={params.search} onChange={setSearch} placeholder="Nom, contact, ville…" className="w-full sm:w-72" />
      </div>

      <Card flush>
        <DataTable
          rows={data?.data ?? []}
          rowKey={(c) => c.id}
          loading={isLoading}
          busy={isFetching}
          empty="Aucun client."
          sort={{ key: params.sort, dir: params.dir }}
          onSort={setSort}
          columns={[
            {
              key: 'name',
              header: 'Client',
              sortable: true,
              render: (c) => (
                <span>
                  <span className="block font-medium text-gray-900">{c.name}</span>
                  {c.contact_name && <span className="block text-xs text-gray-500">{c.contact_name}</span>}
                </span>
              ),
            },
            {
              key: 'contact',
              header: 'Contact',
              render: (c) => (
                <span className="text-sm">
                  {c.phone && (
                    <a href={`tel:${c.phone.replace(/\s+/g, '')}`} className="block text-primary hover:underline">
                      {c.phone}
                    </a>
                  )}
                  {c.email && <span className="block text-xs text-gray-500">{c.email}</span>}
                </span>
              ),
            },
            { key: 'city', header: 'Lieu', sortable: true, render: (c) => [c.address, c.city].filter(Boolean).join(', ') || '—' },
            {
              key: 'chantiers',
              header: 'Chantiers',
              render: (c) => (
                <Link to={`/chantiers?search=${encodeURIComponent(c.name)}`} className="text-primary hover:underline">
                  {c.chantiers_count ?? 0}
                </Link>
              ),
            },
          ]}
          actions={(c) => (
            <>
              <Button variant="ghost" size="sm" onClick={() => openEdit(c)}>
                Modifier
              </Button>
              <Button variant="ghost" size="sm" className="text-red-600 hover:bg-red-50" onClick={() => onDelete(c)}>
                Supprimer
              </Button>
            </>
          )}
        />
        <Pagination meta={data?.meta} onPageChange={setPage} />
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Modifier le client' : 'Nouveau client'} size="lg">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {formError && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</p>}
          <Input label="Nom du client" error={errors.name?.message} {...register('name')} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Personne de contact" error={errors.contact_name?.message} {...register('contact_name')} />
            <Input label="Téléphone" type="tel" error={errors.phone?.message} {...register('phone')} />
            <div className="sm:col-span-2">
              <Input label="Email" type="email" error={errors.email?.message} {...register('email')} />
            </div>
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
          </div>
          <Textarea label="Notes" rows={3} error={errors.notes?.message} {...register('notes')} />
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
