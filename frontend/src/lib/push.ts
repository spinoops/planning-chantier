import { api } from '@/lib/api'

/*
 * Notifications push (Web Push) : abonnement de cet appareil auprès du navigateur,
 * puis enregistrement de l'abonnement côté API. La réception est dans public/sw.js.
 *
 * iPhone / iPad : disponible uniquement quand l'app est ajoutée à l'écran d'accueil
 * (iOS 16.4+) ; dans un onglet Safari, `PushManager` n'existe pas.
 */

export function pushSupported(): boolean {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

export function pushPermission(): NotificationPermission | 'unsupported' {
  return pushSupported() ? Notification.permission : 'unsupported'
}

/** App ouverte depuis l'icône de l'écran d'accueil (mode « standalone »). */
export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true
}

export function isIos(): boolean {
  if (typeof navigator === 'undefined') return false
  return /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

async function registration(): Promise<ServiceWorkerRegistration> {
  const existing = await navigator.serviceWorker.getRegistration()
  if (existing) return existing
  return navigator.serviceWorker.register('/sw.js')
}

/** Abonnement push actuel de cet appareil (null si aucun). */
export async function currentSubscription(): Promise<PushSubscription | null> {
  if (!pushSupported()) return null
  try {
    const reg = await registration()
    return await reg.pushManager.getSubscription()
  } catch {
    return null
  }
}

/** Clé VAPID (base64 URL) → tableau d'octets attendu par `pushManager.subscribe`. */
function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'))
  const out = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

/**
 * Demande la permission, abonne l'appareil et enregistre l'abonnement côté API.
 * Lève une erreur lisible si l'utilisateur refuse ou si le navigateur ne gère pas.
 */
export async function subscribePush(): Promise<void> {
  if (!pushSupported()) {
    throw new Error(isIos() && !isStandalone() ? "Sur iPhone, ajoute d'abord l'app à l'écran d'accueil (Partager → Sur l'écran d'accueil), puis ouvre-la depuis l'icône." : 'Ce navigateur ne gère pas les notifications.')
  }
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') {
    throw new Error('Notifications refusées. Tu peux les autoriser dans les réglages du navigateur.')
  }
  const { data } = await api.get<{ public_key: string }>('/push/public-key')
  if (!data.public_key) throw new Error('Clé de notification absente côté serveur (VAPID).')

  const reg = await registration()
  await navigator.serviceWorker.ready
  const existing = await reg.pushManager.getSubscription()
  const subscription =
    existing ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(data.public_key) }))

  const json = subscription.toJSON()
  const encodings = (PushManager as unknown as { supportedContentEncodings?: string[] }).supportedContentEncodings ?? []
  await api.post('/push/subscriptions', {
    endpoint: json.endpoint,
    keys: json.keys,
    content_encoding: encodings.includes('aes128gcm') ? 'aes128gcm' : 'aesgcm',
  })
}

/** Désabonne cet appareil (navigateur + API). */
export async function unsubscribePush(): Promise<void> {
  const subscription = await currentSubscription()
  if (!subscription) return
  try {
    await api.delete('/push/subscriptions', { data: { endpoint: subscription.endpoint } })
  } finally {
    await subscription.unsubscribe()
  }
}

/** Envoie une notification de test à tous les appareils abonnés de l'utilisateur. */
export async function sendTestPush(): Promise<string> {
  const { data } = await api.post<{ message: string }>('/push/test')
  return data.message
}
