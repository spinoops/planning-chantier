import axios from 'axios'
import { toast } from '@/lib/toast'

// En développement : l'API Laravel tourne à part (VITE_API_URL, frontend/.env).
// En production : même domaine que l'interface (doc root backend/public) → adresse relative.
const API_BASE = import.meta.env.VITE_API_URL ?? (import.meta.env.DEV ? 'http://localhost:8000' : '')
const TOKEN_KEY = 'planningchantier_token'

/** Instance axios partagée, préfixée par /api. */
export const api = axios.create({
  baseURL: `${API_BASE}/api`,
  headers: {
    Accept: 'application/json',
  },
})

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function setToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token)
    else localStorage.removeItem(TOKEN_KEY)
  } catch {
    // stockage indisponible (navigation privée) : la session ne survivra pas au rechargement
  }
}

// Abonnés prévenus quand l'API répond 401 (token expiré/révoqué) : AuthContext
// s'en sert pour vider l'utilisateur courant et renvoyer vers /login.
const unauthorizedListeners = new Set<() => void>()

export function onUnauthorized(listener: () => void): () => void {
  unauthorizedListeners.add(listener)
  return () => {
    unauthorizedListeners.delete(listener)
  }
}

// Ajoute automatiquement le token Bearer à chaque requête.
api.interceptors.request.use((config) => {
  const token = getToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Erreurs globales : 401 → purge du token ; réseau / 5xx → toast.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status
    if (status === 401 && getToken()) {
      setToken(null)
      unauthorizedListeners.forEach((listener) => listener())
    }
    if (!error.response) {
      toast('Impossible de joindre le serveur.', 'error')
    } else if (status >= 500) {
      toast('Une erreur serveur est survenue.', 'error')
    }
    return Promise.reject(error)
  },
)

/**
 * Télécharge un fichier servi par l'API (qui exige le token Bearer, donc pas
 * de simple lien <a href>). Déclenche l'enregistrement côté navigateur.
 */
export async function downloadFile(url: string, filename: string): Promise<void> {
  const response = await api.get<Blob>(url, { responseType: 'blob' })
  const objectUrl = URL.createObjectURL(response.data)
  const link = document.createElement('a')
  link.href = objectUrl
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(objectUrl)
}
