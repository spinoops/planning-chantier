import { useCallback, useEffect, useState } from 'react'
import { currentSubscription, pushPermission, subscribePush, unsubscribePush } from '@/lib/push'

export interface PushState {
  /** Le navigateur gère les notifications push. */
  supported: boolean
  permission: NotificationPermission | 'unsupported'
  /** Cet appareil est abonné. */
  subscribed: boolean
  /** Vérification initiale en cours. */
  checking: boolean
  busy: boolean
  enable: () => Promise<void>
  disable: () => Promise<void>
}

/** État des notifications push sur cet appareil + activation / désactivation. */
export function usePush(): PushState {
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>(() => pushPermission())
  const [subscribed, setSubscribed] = useState(false)
  const [checking, setChecking] = useState(true)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    currentSubscription()
      .then((sub) => {
        if (!cancelled) setSubscribed(Boolean(sub))
      })
      .finally(() => {
        if (!cancelled) setChecking(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const enable = useCallback(async () => {
    setBusy(true)
    try {
      await subscribePush()
      setSubscribed(true)
    } finally {
      setPermission(pushPermission())
      setBusy(false)
    }
  }, [])

  const disable = useCallback(async () => {
    setBusy(true)
    try {
      await unsubscribePush()
      setSubscribed(false)
    } finally {
      setBusy(false)
    }
  }, [])

  return { supported: permission !== 'unsupported', permission, subscribed, checking, busy, enable, disable }
}
