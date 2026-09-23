import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { isAxiosError } from 'axios'
import { api } from '@/lib/api'
import { getErrorMessage } from '@/lib/errors'
import { toast } from '@/lib/toast'
import AuthShell from '@/components/AuthShell'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'

const schema = z
  .object({
    password: z.string().min(8, 'Au moins 8 caractères.'),
    password_confirmation: z.string(),
  })
  .refine((data) => data.password === data.password_confirmation, {
    message: 'Les mots de passe ne correspondent pas.',
    path: ['password_confirmation'],
  })

type FormValues = z.infer<typeof schema>

export default function ResetPasswordPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const token = params.get('token') ?? ''
  const email = params.get('email') ?? ''

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  async function onSubmit(values: FormValues) {
    setError(null)
    try {
      await api.post('/reset-password', { token, email, ...values })
      toast('Mot de passe réinitialisé. Tu peux te connecter.', 'success')
      navigate('/login')
    } catch (err) {
      setError(isAxiosError(err) && err.response?.status === 422 ? 'Lien invalide ou expiré.' : getErrorMessage(err))
    }
  }

  return (
    <AuthShell title="Nouveau mot de passe">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {error && <p className="text-sm text-red-600">{error}</p>}
        <p className="text-sm text-gray-600">
          Pour <span className="font-medium">{email}</span>
        </p>
        <Input
          label="Nouveau mot de passe"
          type="password"
          autoComplete="new-password"
          error={errors.password?.message}
          {...register('password')}
        />
        <Input
          label="Confirmer le mot de passe"
          type="password"
          autoComplete="new-password"
          error={errors.password_confirmation?.message}
          {...register('password_confirmation')}
        />
        <Button type="submit" loading={isSubmitting} className="w-full">
          Réinitialiser
        </Button>
        <p className="text-center text-sm">
          <Link to="/login" className="text-primary hover:underline">
            Retour à la connexion
          </Link>
        </p>
      </form>
    </AuthShell>
  )
}
