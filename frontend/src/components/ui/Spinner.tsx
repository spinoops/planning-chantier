interface SpinnerProps {
  label?: string
  /** Centre l'indicateur dans un bloc avec marge (chargement d'une page). */
  block?: boolean
}

export default function Spinner({ label = 'Chargement…', block = false }: SpinnerProps) {
  return (
    <div className={`flex items-center gap-2 text-sm text-gray-500 ${block ? 'justify-center py-10' : ''}`} role="status">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-primary" />
      {label}
    </div>
  )
}
