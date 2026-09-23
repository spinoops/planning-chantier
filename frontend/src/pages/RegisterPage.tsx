import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { isAxiosError } from 'axios'
import { useAuth } from '@/auth/AuthContext'
import { api } from '@/lib/api'
import { applyValidationErrors, getErrorMessage } from '@/lib/errors'
import { toast } from '@/lib/toast'
import type { InvitationInfo, LoginResponse } from '@/types'
import AuthShell from '@/components/AuthShell'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Spinner from '@/components/ui/Spinner'

const schema = z
  .object({
    name: z.string().min(1, 'Nom requis.'),
    password: z.string().min(8, 'Au moins 8 caractères.'),
    password_confirmation: z.string(),
  })
  .refine((data) => data.password === data.password_confirmation, {
    message: 'Les mots de passe ne correspondent pas.',
    path: ['password_confirmation'],
  })

type FormValues = z.infer<typeof schema>

/**
 * Inscription sur invitation : `/register/:token`.
 * L'email n'est pas saisissable — il provient de l'invitation.
 */
export default function RegisterPage() {
  const { token = '' } = useParams<{ token: string }>()
  const navigate = useNavigate()
  const { authenticate } = useAuth()

  const [invitation, setInvitation] = useState<InvitationInfo | null>(null)
  const [checking, setChecking] = useState(true)
  const [linkError, setLinkError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  // Validation du lien avant d'afficher le formulaire.
  useEffect(() => {
    let cancelled = false
    api
      .get<InvitationInfo>(`/register/${token}`)
      .then((response) => {
        if (!cancelled) setInvitation(response.data)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setLinkError(
          isAxiosError(err) && err.response?.status === 410
            ? (err.response.data?.message ?? "Ce lien d'invitation n'est plus valable.")
            : "Ce lien d'invitation est invalide.",
        )
      })
      .finally(() => {
        if (!cancelled) setChecking(false)
      })
    return () => {
      cancelled = true
    }
  }, [token])

  async function onSubmit(values: FormValues) {
    setFormError(null)
    try {
      const response = await api.post<LoginResponse>(`/register/${token}`, values)
      authenticate(response.data.token, response.data.user)
      toast('Bienvenue ! Ton compte est créé.', 'success')
      navigate('/dashboard')
    } catch (err) {
      if (isAxiosError(err) && err.response?.status === 410) {
        setLinkError(err.response.data?.message ?? "Ce lien d'invitation n'est plus valable.")
      } else if (!applyValidationErrors(err, setError)) {
        setFormError(getErrorMessage(err))
      }
    }
  }

  return (
    <AuthShell title={linkError ? 'Lien inutilisable' : 'Créer mon compte'}>
      {checking ? (
        <div className="flex justify-center py-4">
          <Spinner />
        </div>
      ) : linkError ? (
        <div className="space-y-4">
          <p className="text-sm text-gray-600">{linkError}</p>
          <p className="text-sm text-gray-600">Demande une nouvelle invitation à la personne qui t'a convié.</p>
          <p className="text-center text-sm">
            <Link to="/login" className="text-primary hover:underline">
              Retour à la connexion
            </Link>
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <p className="text-sm text-gray-600">
            <span className="font-medium">{invitation?.inviter_name}</span> t'invite à rejoindre l'application.
          </p>
          {formError && <p className="text-sm text-red-600">{formError}</p>}
          <Input label="Email" type="email" value={invitation?.email ?? ''} disabled readOnly />
          <Input label="Ton nom" autoComplete="name" error={errors.name?.message} {...register('name')} />
          <Input label="Mot de passe" type="password" autoComplete="new-password" error={errors.password?.message} {...register('password')} />
          <Input
            label="Confirmer le mot de passe"
            type="password"
            autoComplete="new-password"
            error={errors.password_confirmation?.message}
            {...register('password_confirmation')}
          />
          <Button type="submit" loading={isSubmitting} className="w-full">
            Créer mon compte
          </Button>
          <p className="text-center text-sm">
            <Link to="/login" className="text-primary hover:underline">
              J'ai déjà un compte
            </Link>
          </p>
        </form>
      )}
    </AuthShell>
  )
}
