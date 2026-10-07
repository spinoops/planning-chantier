import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useAuth } from '@/auth/AuthContext'
import { getErrorMessage } from '@/lib/errors'
import AuthShell from '@/components/AuthShell'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'

const schema = z.object({
  email: z.string().email('Email invalide.'),
  password: z.string().min(1, 'Mot de passe requis.'),
})

type FormValues = z.infer<typeof schema>

// Formulaire vide : aucun compte prérempli, même en développement.
const EMPTY = { email: '', password: '' }

export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [error, setError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: EMPTY })

  // Page demandée avant la redirection vers /login (ProtectedRoute).
  const from = (location.state as { from?: string } | null)?.from ?? '/dashboard'

  async function onSubmit(values: FormValues) {
    setError(null)
    try {
      await login(values.email, values.password)
      navigate(from, { replace: true })
    } catch (err) {
      setError(getErrorMessage(err, 'Identifiants invalides.'))
    }
  }

  return (
    <AuthShell title="Connexion">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Input label="Email" type="email" autoComplete="email" error={errors.email?.message} {...register('email')} />
        <Input
          label="Mot de passe"
          type="password"
          autoComplete="current-password"
          error={errors.password?.message}
          {...register('password')}
        />
        <Button type="submit" loading={isSubmitting} className="w-full">
          Se connecter
        </Button>
        <p className="text-center text-sm">
          <Link to="/forgot-password" className="text-primary hover:underline">
            Mot de passe oublié ?
          </Link>
        </p>
      </form>
    </AuthShell>
  )
}
