import { isAxiosError } from 'axios'
import type { FieldValues, Path, UseFormSetError } from 'react-hook-form'

/** Erreurs de validation Laravel (422) : champ => messages. */
type ValidationErrors = Record<string, string[]>

function validationErrors(err: unknown): ValidationErrors | null {
  if (isAxiosError(err) && err.response?.status === 422) {
    return (err.response.data?.errors as ValidationErrors | undefined) ?? null
  }
  return null
}

/**
 * Message lisible pour n'importe quelle erreur d'appel API :
 * message du serveur, première erreur de validation, ou libellé générique.
 */
export function getErrorMessage(err: unknown, fallback = 'Une erreur est survenue.'): string {
  if (isAxiosError(err)) {
    if (!err.response) return 'Impossible de joindre le serveur.'
    const { status, data } = err.response
    const first = validationErrors(err)
    if (first) return Object.values(first)[0]?.[0] ?? data?.message ?? 'Données invalides.'
    if (status === 429) return 'Trop de tentatives. Réessaie dans une minute.'
    if (status === 403) return data?.message ?? 'Action non autorisée.'
    if (typeof data?.message === 'string' && data.message) return data.message
  }
  return fallback
}

/**
 * Reporte les erreurs de validation (422) sur les champs d'un formulaire
 * react-hook-form. Renvoie true si des erreurs ont été appliquées.
 *
 *   onError: (err) => { if (!applyValidationErrors(err, setError)) setFormError(getErrorMessage(err)) }
 */
export function applyValidationErrors<T extends FieldValues>(err: unknown, setError: UseFormSetError<T>): boolean {
  const errors = validationErrors(err)
  if (!errors) return false

  let applied = false
  for (const [field, messages] of Object.entries(errors)) {
    setError(field as Path<T>, { type: 'server', message: messages[0] })
    applied = true
  }
  return applied
}
