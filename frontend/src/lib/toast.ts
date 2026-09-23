export type ToastType = 'success' | 'error' | 'info'

export interface Toast {
  id: number
  message: string
  type: ToastType
}

type Listener = (toasts: Toast[]) => void

let toasts: Toast[] = []
let nextId = 1
const listeners = new Set<Listener>()

function emit(): void {
  listeners.forEach((listener) => listener(toasts))
}

/** S'abonne aux changements de la liste des toasts. Renvoie une fonction de désabonnement. */
export function subscribe(listener: Listener): () => void {
  listeners.add(listener)
  listener(toasts)
  return () => {
    listeners.delete(listener)
  }
}

/** Affiche un toast (auto-fermé après 4 s). */
export function toast(message: string, type: ToastType = 'info'): void {
  const id = nextId++
  toasts = [...toasts, { id, message, type }]
  emit()
  setTimeout(() => dismiss(id), 4000)
}

export function dismiss(id: number): void {
  toasts = toasts.filter((item) => item.id !== id)
  emit()
}
