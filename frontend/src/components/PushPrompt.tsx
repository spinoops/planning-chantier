import { useState } from 'react'
import { Link } from 'react-router-dom'
import { usePush } from '@/hooks/usePush'
import { getErrorMessage } from '@/lib/errors'
import { isIos, isStandalone } from '@/lib/push'
import { toast } from '@/lib/toast'
import Button from '@/components/ui/Button'

const DISMISS_KEY = 'push_prompt_dismissed'

function dismissed(): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) === '1'
  } catch {
    return false
  }
}

/**
 * Invitation discrète, dans « Mon planning », à activer les alertes sur ce
 * téléphone. Disparaît une fois activée ou si l'utilisateur dit « plus tard ».
 */
export default function PushPrompt() {
  const push = usePush()
  const [hidden, setHidden] = useState(dismissed)

  const needsHomeScreen = isIos() && !isStandalone() && !push.supported
  if (hidden || push.checking || push.subscribed || push.permission === 'denied' || (!push.supported && !needsHomeScreen)) return null

  function later() {
    setHidden(true)
    try {
      localStorage.setItem(DISMISS_KEY, '1')
    } catch {
      // ignore
    }
  }

  async function enable() {
    try {
      await push.enable()
      toast('Alertes activées : tu seras prévenu avant chaque chantier.', 'success')
    } catch (err) {
      toast(err instanceof Error ? err.message : getErrorMessage(err), 'error')
    }
  }

  return (
    <div className="glass-panel mb-5 flex flex-wrap items-center gap-3 rounded-card px-4 py-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/12 text-primary">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
          <path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15L6 16ZM10 20a2 2 0 0 0 4 0" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      <div className="min-w-0 flex-1 basis-56">
        <p className="text-sm font-semibold text-gray-900">Recevoir une alerte avant chaque chantier ?</p>
        <p className="text-xs text-gray-500">
          {needsHomeScreen
            ? "Sur iPhone : Partager → « Sur l'écran d'accueil », puis ouvre l'app depuis l'icône."
            : 'Un rappel sur ce téléphone 1 h avant, et si ton planning change. Réglable dans Mon profil.'}
        </p>
      </div>
      <div className="flex shrink-0 gap-2">
        <Button variant="ghost" size="sm" onClick={later}>
          Plus tard
        </Button>
        {needsHomeScreen ? (
          <Link to="/profile">
            <Button size="sm">Voir comment</Button>
          </Link>
        ) : (
          <Button size="sm" onClick={() => void enable()} loading={push.busy}>
            Activer
          </Button>
        )}
      </div>
    </div>
  )
}
