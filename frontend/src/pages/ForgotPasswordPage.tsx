import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { api } from '@/lib/api'
import { getErrorMessage } from '@/lib/errors'
import AuthShell from '@/components/AuthShell'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'

const schema = z.object({ email: z.string().email('Email invalide.') })

type FormValues = z.infer<typeof schema>

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  async function onSubmit(values: FormValues) {
    setError(null)
    try {
      await api.post('/forgot-password', values)
      setSent(true)
    } catch (err) {
      setError(getErrorMessage(err))
    }
  }

  return (
    <AuthShell title="Mot de passe oublié">
      {sent ? (
        <p className="text-sm text-gray-600">
          Si un compte existe pour cet email, un lien de réinitialisation vient d'être envoyé.
        </p>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <p className="text-sm text-gray-600">Entre ton email pour recevoir un lien de réinitialisation.</p>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Input label="Email" type="email" autoComplete="email" error={errors.email?.message} {...register('email')} />
          <Button type="submit" loading={isSubmitting} className="w-full">
            Envoyer le lien
          </Button>
        </form>
      )}
      <p className="text-center text-sm">
        <Link to="/login" className="text-primary hover:underline">
          Retour à la connexion
        </Link>
      </p>
    </AuthShell>
  )
}
