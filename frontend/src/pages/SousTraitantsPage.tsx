import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useCreateSousTraitant, useDeleteSousTraitant, useSousTraitants, useUpdateSousTraitant } from '@/hooks/useSousTraitants'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { applyValidationErrors, getErrorMessage } from '@/lib/errors'
import { toast } from '@/lib/toast'
import type { SousTraitant } from '@/types'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import DataTable from '@/components/ui/DataTable'
import Input from '@/components/ui/Input'
import Modal from '@/components/ui/Modal'
import PageHeader from '@/components/ui/PageHeader'
import SearchInput from '@/components/ui/SearchInput'
import Textarea from '@/components/ui/Textarea'

const schema = z.object({
  name: z.string().min(1, 'Nom requis.').max(255),
  trade: z.string().max(100),
  contact_name: z.string().max(255),
  phone: z.string().max(40),
  email: z.string().max(255),
  notes: z.string().max(5000),
})

type FormValues = z.infer<typeof schema>
const EMPTY: FormValues = { name: '', trade: '', contact_name: '', phone: '', email: '', notes: '' }

const fold = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()

/** Sous-traitants (électricien, sanitaire…) : prévus sur les chantiers depuis la fiche de préparation. */
export default function SousTraitantsPage() {
  const { data: rows = [], isLoading, isFetching } = useSousTraitants()
  const create = useCreateSousTraitant()
  const update = useUpdateSousTraitant()
  const remove = useDeleteSousTraitant()
  const confirm = useConfirm()

  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<SousTraitant | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const q = fold(search.trim())
    if (!q) return rows
    return rows.filter((s) => fold([s.name, s.trade, s.contact_name, s.phone, s.email].filter(Boolean).join(' ')).includes(q))
  }, [rows, search])

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: EMPTY })

  function openCreate() {
    setEditing(null)
    setFormError(null)
    reset(EMPTY)
    setModalOpen(true)
  }

  function openEdit(s: SousTraitant) {
    setEditing(s)
    setFormError(null)
    reset({ name: s.name, trade: s.trade ?? '', contact_name: s.contact_name ?? '', phone: s.phone ?? '', email: s.email ?? '', notes: s.notes ?? '' })
    setModalOpen(true)
  }

  function onSubmit(values: FormValues) {
    setFormError(null)
    const payload = {
      name: values.name.trim(),
      trade: values.trade.trim() || null,
      contact_name: values.contact_name.trim() || null,
      phone: values.phone.trim() || null,
      email: values.email.trim() || null,
      notes: values.notes.trim() || null,
    }
    const onSuccess = () => {
      setModalOpen(false)
      toast(editing ? 'Sous-traitant mis à jour.' : 'Sous-traitant créé.', 'success')
    }
    const onError = (err: unknown) => {
      if (!applyValidationErrors(err, setError)) setFormError(getErrorMessage(err))
    }
    if (editing) update.mutate({ id: editing.id, payload }, { onSuccess, onError })
    else create.mutate(payload, { onSuccess, onError })
  }

  async function onDelete(s: SousTraitant) {
    const ok = await confirm({
      title: `Supprimer « ${s.name} » ?`,
      message: s.chantiers_count ? `Ce sous-traitant est prévu sur ${s.chantiers_count} chantier(s) : il en sera retiré.` : 'Le sous-traitant sera retiré de la liste.',
      confirmLabel: 'Supprimer',
      danger: true,
    })
    if (!ok) return
    remove.mutate(s.id, { onSuccess: () => toast('Sous-traitant supprimé.', 'success'), onError: (err) => toast(getErrorMessage(err, 'Suppression impossible.'), 'error') })
  }

  return (
    <div>
      <PageHeader title="Sous-traitants" action={<Button onClick={openCreate}>Nouveau sous-traitant</Button>} />

      <div className="mb-4">
        <SearchInput value={search} onChange={setSearch} placeholder="Nom, métier, contact…" className="w-full sm:w-72" />
      </div>

      <Card flush>
        <DataTable
          rows={filtered}
          rowKey={(s) => s.id}
          loading={isLoading}
          busy={isFetching}
          empty={search ? 'Aucun sous-traitant ne correspond.' : 'Aucun sous-traitant.'}
          columns={[
            {
              key: 'name',
              header: 'Sous-traitant',
              render: (s) => (
                <span>
                  <span className="block font-medium text-gray-900">{s.name}</span>
                  {s.contact_name && <span className="block text-xs text-gray-500">{s.contact_name}</span>}
                </span>
              ),
            },
            { key: 'trade', header: 'Métier', render: (s) => s.trade || '—' },
            {
              key: 'contact',
              header: 'Contact',
              render: (s) => (
                <span className="text-sm">
                  {s.phone && (
                    <a href={`tel:${s.phone.replace(/\s+/g, '')}`} className="block text-primary hover:underline">
                      {s.phone}
                    </a>
                  )}
                  {s.email && (
                    <a href={`mailto:${s.email}`} className="block text-xs text-gray-500 hover:underline">
                      {s.email}
                    </a>
                  )}
                  {!s.phone && !s.email && '—'}
                </span>
              ),
            },
            { key: 'chantiers', header: 'Chantiers', render: (s) => s.chantiers_count ?? 0 },
          ]}
          actions={(s) => (
            <>
              <Button variant="ghost" size="sm" onClick={() => openEdit(s)}>
                Modifier
              </Button>
              <Button variant="ghost" size="sm" className="text-red-600 hover:bg-red-50" onClick={() => onDelete(s)}>
                Supprimer
              </Button>
            </>
          )}
        />
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Modifier le sous-traitant' : 'Nouveau sous-traitant'} size="lg">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {formError && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</p>}
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Nom de l'entreprise" error={errors.name?.message} {...register('name')} />
            <Input label="Métier" placeholder="Électricien, sanitaire, maçon…" error={errors.trade?.message} {...register('trade')} />
            <Input label="Personne de contact" error={errors.contact_name?.message} {...register('contact_name')} />
            <Input label="Téléphone" type="tel" error={errors.phone?.message} {...register('phone')} />
            <div className="sm:col-span-2">
              <Input label="Email" type="email" error={errors.email?.message} {...register('email')} />
            </div>
          </div>
          <Textarea label="Notes" rows={3} placeholder="Délais habituels, conditions, remarques…" error={errors.notes?.message} {...register('notes')} />
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
