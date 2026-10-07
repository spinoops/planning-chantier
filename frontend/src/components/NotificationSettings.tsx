import { useState } from 'react'
import { useAuth } from '@/auth/AuthContext'
import { useUpdateProfile } from '@/hooks/useProfile'
import { usePush } from '@/hooks/usePush'
import { getErrorMessage } from '@/lib/errors'
import { isIos, isStandalone, sendTestPush } from '@/lib/push'
import { toast } from '@/lib/toast'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import Select from '@/components/ui/Select'
import Toggle from '@/components/ui/Toggle'

const DELAYS: { value: number; label: string }[] = [
  { value: 0, label: 'Jamais' },
  { value: 15, label: '15 minutes avant' },
  { value: 30, label: '30 minutes avant' },
  { value: 60, label: '1 heure avant' },
  { value: 120, label: '2 heures avant' },
  { value: 180, label: '3 heures avant' },
]

/**
 * Carte « Alertes » du profil : activer les notifications sur cet appareil,
 * choisir le délai de rappel avant un chantier, être prévenu des changements,
 * envoyer une notification de test.
 */
export default function NotificationSettings() {
  const { user } = useAuth()
  const push = usePush()
  const updateProfile = useUpdateProfile()
  const [testing, setTesting] = useState(false)

  const needsHomeScreen = isIos() && !isStandalone() && !push.supported

  function savePrefs(patch: { notify_before_minutes?: number; notify_changes?: boolean }) {
    if (!user) return
    updateProfile.mutate(
      { name: user.name, email: user.email, phone: user.phone, ...patch },
      { onError: (err) => toast(getErrorMessage(err), 'error') },
    )
  }

  async function toggleDevice(on: boolean) {
    try {
      if (on) {
        await push.enable()
        toast('Alertes activées sur cet appareil.', 'success')
      } else {
        await push.disable()
        toast('Alertes désactivées sur cet appareil.', 'info')
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : getErrorMessage(err), 'error')
    }
  }

  async function test() {
    setTesting(true)
    try {
      toast(await sendTestPush(), 'success')
    } catch (err) {
      toast(getErrorMessage(err), 'error')
    } finally {
      setTesting(false)
    }
  }

  return (
    <Card title="Alertes" description="Un rappel sur ton téléphone avant chaque chantier, et quand ton planning change.">
      <div className="space-y-5">
        {/* Cet appareil */}
        <div className="flex items-start justify-between gap-4 rounded-2xl bg-white/40 p-4">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900">Alertes sur cet appareil</p>
            <p className="mt-0.5 text-xs leading-snug text-gray-500">
              {push.checking
                ? 'Vérification…'
                : needsHomeScreen
                  ? "Sur iPhone : Partager → « Sur l'écran d'accueil », puis ouvre l'app depuis l'icône pour activer les alertes."
                  : !push.supported
                    ? 'Ce navigateur ne gère pas les notifications.'
                    : push.permission === 'denied'
                      ? 'Notifications bloquées : autorise-les dans les réglages du navigateur pour ce site.'
                      : push.subscribed
                        ? 'Ce téléphone / ordinateur reçoit les alertes, même app fermée.'
                        : 'Active pour recevoir les rappels ici.'}
            </p>
          </div>
          <Toggle
            checked={push.subscribed}
            onChange={(on) => void toggleDevice(on)}
            disabled={push.checking || push.busy || !push.supported || push.permission === 'denied'}
            aria-label="Alertes sur cet appareil"
          />
        </div>

        <Select
          label="Me rappeler avant un chantier"
          value={String(user?.notify_before_minutes ?? 60)}
          onChange={(e) => savePrefs({ notify_before_minutes: Number(e.target.value) })}
          disabled={updateProfile.isPending}
        >
          {DELAYS.map((d) => (
            <option key={d.value} value={d.value}>
              {d.label}
            </option>
          ))}
        </Select>

        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-gray-800">Me prévenir si mon planning change</p>
            <p className="text-xs text-gray-500">Chantier ajouté, modifié ou annulé pour aujourd'hui ou demain.</p>
          </div>
          <Toggle checked={user?.notify_changes ?? true} onChange={(on) => savePrefs({ notify_changes: on })} disabled={updateProfile.isPending} aria-label="Prévenir si mon planning change" />
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t border-black/[0.06] pt-4">
          <Button variant="secondary" size="sm" onClick={() => void test()} loading={testing} disabled={!push.subscribed}>
            Envoyer une alerte de test
          </Button>
          <p className="text-xs text-gray-500">Les rappels partent aux heures de début de tes chantiers, à la minute près.</p>
        </div>
      </div>
    </Card>
  )
}
