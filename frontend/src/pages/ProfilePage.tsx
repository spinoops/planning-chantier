import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useAuth } from '@/auth/AuthContext'
import { useUpdatePassword, useUpdateProfile } from '@/hooks/useProfile'
import { useRoles } from '@/hooks/useRoles'
import { applyValidationErrors, getErrorMessage } from '@/lib/errors'
import { toast } from '@/lib/toast'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import Input from '@/components/ui/Input'
import PageHeader from '@/components/ui/PageHeader'
import NotificationSettings from '@/components/NotificationSettings'

const profileSchema = z.object({
  name: z.string().min(1, 'Nom requis.').max(255),
  email: z.string().email('Email invalide.'),
  phone: z.string().max(40),
})

const passwordSchema = z
  .object({
    current_password: z.string().min(1, 'Mot de passe actuel requis.'),
    password: z.string().min(8, 'Au moins 8 caractères.'),
    password_confirmation: z.string(),
  })
  .refine((data) => data.password === data.password_confirmation, {
    message: 'Les mots de passe ne correspondent pas.',
    path: ['password_confirmation'],
  })

type ProfileValues = z.infer<typeof profileSchema>
type PasswordValues = z.infer<typeof passwordSchema>

export default function ProfilePage() {
  const { user, isAdmin } = useAuth()
  const { data: roles } = useRoles(isAdmin)
  const updateProfile = useUpdateProfile()
  const updatePassword = useUpdatePassword()

  const profileForm = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: user?.name ?? '', email: user?.email ?? '', phone: user?.phone ?? '' },
  })
  const passwordForm = useForm<PasswordValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { current_password: '', password: '', password_confirmation: '' },
  })

  useEffect(() => {
    if (user) profileForm.reset({ name: user.name, email: user.email, phone: user.phone ?? '' })
  }, [user, profileForm])

  function onProfile(values: ProfileValues) {
    updateProfile.mutate(values, {
      onSuccess: () => toast('Profil mis à jour.', 'success'),
      onError: (err) => {
        if (!applyValidationErrors(err, profileForm.setError)) toast(getErrorMessage(err), 'error')
      },
    })
  }

  function onPassword(values: PasswordValues) {
    updatePassword.mutate(values, {
      onSuccess: () => {
        passwordForm.reset()
        toast('Mot de passe modifié. Tes autres appareils sont déconnectés.', 'success')
      },
      onError: (err) => {
        if (!applyValidationErrors(err, passwordForm.setError)) toast(getErrorMessage(err), 'error')
      },
    })
  }

  return (
    <div>
      <PageHeader title="Mon profil" subtitle="Tes informations, ton mot de passe et tes alertes." />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Informations" description="Nom affiché et adresse de connexion.">
          <form onSubmit={profileForm.handleSubmit(onProfile)} className="space-y-4">
            <Input label="Nom" error={profileForm.formState.errors.name?.message} {...profileForm.register('name')} />
            <Input label="Email" type="email" error={profileForm.formState.errors.email?.message} {...profileForm.register('email')} />
            <Input
              label="Téléphone"
              type="tel"
              placeholder="+41 79 …"
              hint="Visible par tes collègues dans leur planning pour te joindre sur le chantier."
              error={profileForm.formState.errors.phone?.message}
              {...profileForm.register('phone')}
            />
            <div className="space-y-1">
              <p className="block text-sm font-medium text-gray-700">Rôles</p>
              <div className="flex flex-wrap gap-1">
                {user?.roles.map((r) => (
                  <Badge key={r} tone={r === 'admin' ? 'primary' : 'neutral'}>
                    {roles?.data.find((x) => x.name === r)?.label ?? r}
                  </Badge>
                ))}
              </div>
              <p className="text-xs text-gray-500">Les rôles sont gérés par un administrateur.</p>
            </div>
            <Button type="submit" loading={updateProfile.isPending}>
              Enregistrer
            </Button>
          </form>
        </Card>

        <Card title="Mot de passe" description="Choisis un mot de passe d'au moins 8 caractères.">
          <form onSubmit={passwordForm.handleSubmit(onPassword)} className="space-y-4">
            <Input
              label="Mot de passe actuel"
              type="password"
              autoComplete="current-password"
              error={passwordForm.formState.errors.current_password?.message}
              {...passwordForm.register('current_password')}
            />
            <Input
              label="Nouveau mot de passe"
              type="password"
              autoComplete="new-password"
              error={passwordForm.formState.errors.password?.message}
              {...passwordForm.register('password')}
            />
            <Input
              label="Confirmer le nouveau mot de passe"
              type="password"
              autoComplete="new-password"
              error={passwordForm.formState.errors.password_confirmation?.message}
              {...passwordForm.register('password_confirmation')}
            />
            <Button type="submit" variant="secondary" loading={updatePassword.isPending}>
              Changer le mot de passe
            </Button>
          </form>
        </Card>

        <NotificationSettings />
      </div>
    </div>
  )
}
