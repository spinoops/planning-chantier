import { useEffect } from 'react'
import { useController, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useBackups, useCreateBackup, useDeleteBackup, useDownloadBackup } from '@/hooks/useBackups'
import { useModules, useUpdateModules } from '@/hooks/useModules'
import { useSettings, useUpdateSettings } from '@/hooks/useSettings'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { applyValidationErrors, getErrorMessage } from '@/lib/errors'
import { formatBytes, formatDateTime } from '@/lib/format'
import { toast } from '@/lib/toast'
import ImageField from '@/components/ImageField'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import DataTable from '@/components/ui/DataTable'
import Input from '@/components/ui/Input'
import PageHeader from '@/components/ui/PageHeader'
import Spinner from '@/components/ui/Spinner'
import Toggle from '@/components/ui/Toggle'

const schema = z.object({
  app_name: z.string().min(1, 'Le nom est requis.').max(255),
  app_logo_url: z.string().max(2048),
  app_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Couleur hexadécimale invalide (ex : #4f46e5).'),
})

type FormValues = z.infer<typeof schema>

function IdentitySection() {
  const { data, isLoading } = useSettings()
  const updateSettings = useUpdateSettings()

  const {
    register,
    control,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { app_name: '', app_logo_url: '', app_color: '#e30917' },
  })

  const { field: colorField } = useController({ name: 'app_color', control })
  const { field: logoField } = useController({ name: 'app_logo_url', control })

  useEffect(() => {
    if (data) {
      reset({ app_name: data.app_name, app_logo_url: data.app_logo_url, app_color: data.app_color })
    }
  }, [data, reset])

  function onSubmit(values: FormValues) {
    updateSettings.mutate(values, {
      onSuccess: () => toast('Configuration enregistrée.', 'success'),
      onError: (err) => {
        if (!applyValidationErrors(err, setError)) toast(getErrorMessage(err), 'error')
      },
    })
  }

  if (isLoading) {
    return <Spinner block />
  }

  return (
    <Card title="Identité" description="Nom, logo et couleur appliqués à toute l'interface.">
      <form onSubmit={handleSubmit(onSubmit)} className="max-w-xl space-y-5">
        <Input label="Nom de l'application" error={errors.app_name?.message} {...register('app_name')} />

        <ImageField
          label="Logo (optionnel)"
          value={logoField.value}
          onChange={logoField.onChange}
          placeholder="https://…/logo.png"
          hint="PNG, JPG, WebP ou SVG — 4 Mo max. Sert aussi de favicon."
          error={errors.app_logo_url?.message}
        />

        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700">Couleur principale</label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={colorField.value}
              onChange={colorField.onChange}
              className="h-10 w-16 cursor-pointer rounded border border-gray-300"
              aria-label="Couleur principale"
            />
            <span className="font-mono text-sm text-gray-500">{colorField.value}</span>
          </div>
          {errors.app_color && <p className="text-sm text-red-600">{errors.app_color.message}</p>}
        </div>

        <Button type="submit" loading={updateSettings.isPending}>
          Enregistrer
        </Button>
      </form>
    </Card>
  )
}

const planningSchema = z.object({
  planning_morning_start: z.string().regex(/^\d{2}:\d{2}$/, 'Heure HH:MM'),
  planning_morning_end: z.string().regex(/^\d{2}:\d{2}$/, 'Heure HH:MM'),
  planning_afternoon_start: z.string().regex(/^\d{2}:\d{2}$/, 'Heure HH:MM'),
  planning_afternoon_end: z.string().regex(/^\d{2}:\d{2}$/, 'Heure HH:MM'),
  planning_notify_after: z.string().regex(/^\d{2}:\d{2}$/, 'Heure HH:MM'),
})

type PlanningValues = z.infer<typeof planningSchema>

/** Horaires types proposés dans le planning et heure de veille des changements tardifs. */
function PlanningSection() {
  const { data, isLoading } = useSettings()
  const updateSettings = useUpdateSettings()
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<PlanningValues>({
    resolver: zodResolver(planningSchema),
    defaultValues: { planning_morning_start: '07:30', planning_morning_end: '12:00', planning_afternoon_start: '13:00', planning_afternoon_end: '16:45', planning_notify_after: '16:00' },
  })

  useEffect(() => {
    if (data) {
      reset({
        planning_morning_start: data.planning_morning_start,
        planning_morning_end: data.planning_morning_end,
        planning_afternoon_start: data.planning_afternoon_start,
        planning_afternoon_end: data.planning_afternoon_end,
        planning_notify_after: data.planning_notify_after,
      })
    }
  }, [data, reset])

  function onSubmit(values: PlanningValues) {
    if (!data) return
    updateSettings.mutate(
      { app_name: data.app_name, app_logo_url: data.app_logo_url, app_color: data.app_color, ...values },
      {
        onSuccess: () => toast('Horaires enregistrés.', 'success'),
        onError: (err) => {
          if (!applyValidationErrors(err, setError)) toast(getErrorMessage(err), 'error')
        },
      },
    )
  }

  if (isLoading) return <Spinner block />

  return (
    <Card title="Planning" description="Horaires proposés par les boutons Matin / Après-midi / Journée, et heure après laquelle un changement du planning du lendemain prévient les planificateurs par email.">
      <form onSubmit={handleSubmit(onSubmit)} className="max-w-xl space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <Input label="Matin : début" type="time" error={errors.planning_morning_start?.message} {...register('planning_morning_start')} />
          <Input label="Matin : fin" type="time" error={errors.planning_morning_end?.message} {...register('planning_morning_end')} />
          <Input label="Après-midi : début" type="time" error={errors.planning_afternoon_start?.message} {...register('planning_afternoon_start')} />
          <Input label="Après-midi : fin" type="time" error={errors.planning_afternoon_end?.message} {...register('planning_afternoon_end')} />
        </div>
        <Input label="Prévenir des changements tardifs après" type="time" hint="Un email part aux planificateurs si le planning d'aujourd'hui ou de demain change après cette heure." error={errors.planning_notify_after?.message} {...register('planning_notify_after')} />
        <Button type="submit" loading={updateSettings.isPending}>
          Enregistrer
        </Button>
      </form>
    </Card>
  )
}

function ModulesSection() {
  const { data: modules, isLoading } = useModules()
  const updateModules = useUpdateModules()

  if (isLoading) return <Spinner block />
  if (!modules?.length) return null

  return (
    <Card title="Modules" description="Active ou désactive des fonctions optionnelles. Les menus et routes s'adaptent aussitôt.">
      <ul className="divide-y divide-gray-100">
        {modules.map((module) => (
          <li key={module.key} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-900">
                {module.name}
                {!module.available && <span className="ml-2 text-xs text-gray-400">(bientôt)</span>}
              </p>
              {module.description && <p className="text-sm text-gray-500">{module.description}</p>}
            </div>
            <Toggle
              checked={module.enabled}
              disabled={!module.available || updateModules.isPending}
              aria-label={`Activer ${module.name}`}
              onChange={(enabled) =>
                updateModules.mutate(
                  { [module.key]: enabled },
                  { onError: (err) => toast(getErrorMessage(err), 'error') },
                )
              }
            />
          </li>
        ))}
      </ul>
    </Card>
  )
}

function BackupsSection() {
  const { data: settings } = useSettings()
  const enabled = settings?.modules?.backups ?? false
  const { data: backups, isLoading, isFetching } = useBackups(enabled)
  const createBackup = useCreateBackup()
  const deleteBackup = useDeleteBackup()
  const downloadBackup = useDownloadBackup()
  const confirm = useConfirm()

  if (!enabled) return null

  async function remove(name: string) {
    if (!(await confirm({ title: `Supprimer ${name} ?`, confirmLabel: 'Supprimer', danger: true }))) return
    deleteBackup.mutate(name, {
      onSuccess: () => toast('Sauvegarde supprimée.', 'success'),
      onError: (err) => toast(getErrorMessage(err), 'error'),
    })
  }

  return (
    <Card
      title="Sauvegardes de la base"
      description="Dumps MySQL compressés, avec rotation automatique. Une sauvegarde quotidienne est planifiée si le cron tourne."
      action={
        <Button
          loading={createBackup.isPending}
          onClick={() =>
            createBackup.mutate(undefined, {
              onSuccess: (r) => toast(r.message, 'success'),
              onError: (err) => toast(getErrorMessage(err), 'error'),
            })
          }
        >
          Sauvegarder maintenant
        </Button>
      }
      flush
    >
      <DataTable
        rows={backups ?? []}
        rowKey={(b) => b.name}
        loading={isLoading}
        busy={isFetching}
        empty="Aucune sauvegarde pour l'instant."
        columns={[
          { key: 'name', header: 'Fichier', render: (b) => <span className="font-mono text-xs">{b.name}</span> },
          { key: 'created_at', header: 'Date', render: (b) => formatDateTime(b.created_at) },
          { key: 'size', header: 'Taille', render: (b) => formatBytes(b.size) },
        ]}
        actions={(b) => (
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => downloadBackup.mutate(b.name, { onError: (err) => toast(getErrorMessage(err), 'error') })}
            >
              Télécharger
            </Button>
            <Button variant="ghost" size="sm" className="text-red-600 hover:bg-red-50" onClick={() => remove(b.name)}>
              Supprimer
            </Button>
          </>
        )}
      />
    </Card>
  )
}

export default function SettingsPage() {
  return (
    <div>
      <PageHeader title="Configuration" subtitle="Identité de l'application, modules et sauvegardes." />
      <div className="space-y-6">
        <IdentitySection />
        <PlanningSection />
        <ModulesSection />
        <BackupsSection />
      </div>
    </div>
  )
}
