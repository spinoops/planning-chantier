import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useAuth } from '@/auth/AuthContext'
import { useCreateInvitation, useInvitations, useRevokeInvitation } from '@/hooks/useInvitations'
import { useRoles } from '@/hooks/useRoles'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { applyValidationErrors, getErrorMessage } from '@/lib/errors'
import { formatDate } from '@/lib/format'
import { toast } from '@/lib/toast'
import type { Invitation, InvitationStatus } from '@/types'
import Badge from '@/components/ui/Badge'
import type { BadgeTone } from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import DataTable from '@/components/ui/DataTable'
import Input from '@/components/ui/Input'
import Modal from '@/components/ui/Modal'
import PageHeader from '@/components/ui/PageHeader'
import Pagination from '@/components/ui/Pagination'
import Select from '@/components/ui/Select'

const schema = z.object({
  email: z.string().email('Email invalide.'),
  role: z.string().min(1),
})

type FormValues = z.infer<typeof schema>

const STATUS: Record<InvitationStatus, { text: string; tone: BadgeTone }> = {
  pending: { text: 'En attente', tone: 'warn' },
  accepted: { text: 'Acceptée', tone: 'success' },
  expired: { text: 'Expirée', tone: 'neutral' },
}

export default function InvitationsPage() {
  const { isAdmin } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const page = Math.max(1, Number(searchParams.get('page')) || 1)

  const { data, isLoading, isFetching } = useInvitations(page)
  const { data: roles } = useRoles(isAdmin)
  const createInvitation = useCreateInvitation()
  const revokeInvitation = useRevokeInvitation()
  const confirm = useConfirm()

  const [modalOpen, setModalOpen] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  // Lien de la dernière invitation créée, à copier/transmettre soi-même.
  const [lastLink, setLastLink] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { email: '', role: 'user' } })

  function openCreate() {
    setFormError(null)
    setLastLink(null)
    reset({ email: '', role: roles?.default ?? 'user' })
    setModalOpen(true)
  }

  function onSubmit(values: FormValues) {
    setFormError(null)
    createInvitation.mutate(isAdmin ? values : { email: values.email }, {
      onSuccess: (created) => {
        setLastLink(created.accept_url)
        toast('Invitation envoyée par email.', 'success')
      },
      onError: (err) => {
        if (!applyValidationErrors(err, setError)) setFormError(getErrorMessage(err))
      },
    })
  }

  async function copyLink(link: string) {
    try {
      await navigator.clipboard.writeText(link)
      toast('Lien copié.', 'success')
    } catch {
      toast('Copie impossible : sélectionne le lien manuellement.', 'error')
    }
  }

  async function revoke(invitation: Invitation) {
    if (!(await confirm({ title: `Révoquer l'invitation de ${invitation.email} ?`, confirmLabel: 'Révoquer', danger: true }))) return
    revokeInvitation.mutate(invitation.id, {
      onSuccess: () => toast('Invitation révoquée.', 'success'),
      onError: (err) => toast(getErrorMessage(err, 'Révocation impossible.'), 'error'),
    })
  }

  return (
    <div>
      <PageHeader
        title="Invitations"
        action={<Button onClick={openCreate}>Inviter quelqu'un</Button>}
      />

      <Card flush>
        <DataTable
          rows={data?.data ?? []}
          rowKey={(i) => i.id}
          loading={isLoading}
          busy={isFetching}
          empty="Aucune invitation pour l'instant."
          columns={[
            { key: 'email', header: 'Email', render: (i) => <span className="font-medium text-gray-900">{i.email}</span> },
            { key: 'status', header: 'Statut', render: (i) => <Badge tone={STATUS[i.status].tone}>{STATUS[i.status].text}</Badge> },
            { key: 'role', header: 'Rôle', render: (i) => roles?.data.find((r) => r.name === i.role)?.label ?? i.role },
            ...(isAdmin ? [{ key: 'inviter', header: 'Invité par', render: (i: Invitation) => i.inviter?.name ?? '—' }] : []),
            { key: 'expires_at', header: 'Expire le', render: (i) => formatDate(i.expires_at) },
          ]}
          actions={(i) =>
            i.status === 'pending' ? (
              <Button variant="ghost" size="sm" className="text-red-600 hover:bg-red-50" onClick={() => revoke(i)}>
                Révoquer
              </Button>
            ) : null
          }
        />
        <Pagination
          meta={data?.meta}
          onPageChange={(p) => setSearchParams((prev) => {
            const next = new URLSearchParams(prev)
            next.set('page', String(p))
            return next
          })}
        />
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Inviter quelqu'un">
        {lastLink ? (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              L'invitation a été envoyée par email. Tu peux aussi transmettre ce lien toi-même (WhatsApp, SMS…) :
            </p>
            <p className="break-all rounded-lg bg-gray-50 p-3 font-mono text-xs text-gray-700">{lastLink}</p>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => { setLastLink(null); reset({ email: '', role: roles?.default ?? 'user' }) }}>
                Inviter quelqu'un d'autre
              </Button>
              <Button onClick={() => copyLink(lastLink)}>Copier le lien</Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {formError && <p className="text-sm text-red-600">{formError}</p>}
            <Input label="Adresse email" type="email" placeholder="prenom@example.com" error={errors.email?.message} {...register('email')} />
            {isAdmin && (
              <Select label="Rôle" error={errors.role?.message} {...register('role')}>
                {roles?.data.map((r) => (
                  <option key={r.name} value={r.name}>
                    {r.label}
                  </option>
                ))}
              </Select>
            )}
            <p className="text-sm text-gray-500">Le lien est valable quelques jours et ne peut servir qu'une seule fois.</p>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setModalOpen(false)}>
                Annuler
              </Button>
              <Button type="submit" loading={createInvitation.isPending}>
                Envoyer l'invitation
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  )
}
