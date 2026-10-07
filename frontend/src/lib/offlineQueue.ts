import { api } from '@/lib/api'
import { toast } from '@/lib/toast'

/**
 * File d'attente hors ligne : les saisies faites sans réseau (pointages,
 * imprévus) sont gardées dans le navigateur et envoyées au retour de la
 * connexion. Le planning déjà affiché reste consultable grâce au cache du
 * service worker (public/sw.js).
 */

export interface QueuedRequest {
  id: string
  method: 'post' | 'put'
  url: string
  body: unknown
  queuedAt: string
}

const STORAGE_KEY = 'planningchantier_offline_queue'
const listeners = new Set<(count: number) => void>()

export function isOffline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false
}

export function readQueue(): QueuedRequest[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as QueuedRequest[]) : []
  } catch {
    return []
  }
}

function writeQueue(queue: QueuedRequest[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(queue))
  } catch {
    // stockage indisponible
  }
  listeners.forEach((l) => l(queue.length))
}

export function enqueueOffline(req: Omit<QueuedRequest, 'id' | 'queuedAt'>): void {
  const queue = readQueue()
  queue.push({ ...req, id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, queuedAt: new Date().toISOString() })
  writeQueue(queue)
  toast('Pas de réseau : la saisie sera envoyée dès que la connexion revient.', 'info')
}

/** S'abonne au nombre d'éléments en attente. */
export function onQueueChange(listener: (count: number) => void): () => void {
  listeners.add(listener)
  listener(readQueue().length)
  return () => {
    listeners.delete(listener)
  }
}

let flushing = false

/** Envoie tout ce qui est en attente ; renvoie le nombre d'envois réussis. */
export async function flushQueue(): Promise<number> {
  if (flushing || isOffline()) return 0
  flushing = true
  let sent = 0
  try {
    let queue = readQueue()
    for (const item of [...queue]) {
      try {
        await api.request({ method: item.method, url: item.url, data: item.body })
        queue = queue.filter((q) => q.id !== item.id)
        writeQueue(queue)
        sent++
      } catch (err: unknown) {
        // 4xx = refusé pour de bon (on retire pour ne pas bloquer la file) ; réseau / 5xx = on réessaiera.
        const status = (err as { response?: { status?: number } })?.response?.status
        if (status && status >= 400 && status < 500) {
          queue = queue.filter((q) => q.id !== item.id)
          writeQueue(queue)
          toast('Une saisie hors ligne a été refusée par le serveur et retirée.', 'error')
        } else {
          break
        }
      }
    }
  } finally {
    flushing = false
  }
  if (sent > 0) toast(`${sent} saisie(s) hors ligne envoyée(s).`, 'success')
  return sent
}

/** À appeler une fois au démarrage : vide la file au retour du réseau. */
export function installOfflineSync(): void {
  if (typeof window === 'undefined') return
  window.addEventListener('online', () => {
    void flushQueue()
  })
  if (!isOffline()) void flushQueue()
}
