import type { Client } from '@/types'
import { buildChantierName } from '@/lib/chantierName'
import Input from '@/components/ui/Input'
import ClientSelect from '@/components/planning/ClientSelect'

interface ChantierTitleFieldsProps {
  clientId: string
  /** Nom du client sélectionné (pour l'aperçu du titre). */
  clientName: string
  complement: string
  onClient: (id: string, client: Client | null) => void
  onComplement: (value: string) => void
  clientError?: string
  complementError?: string
  autoFocus?: boolean
}

/**
 * En-tête commun des formulaires de chantier : le client d'abord, puis un
 * complément facultatif. Le titre du chantier = « Client – Complément ».
 */
export default function ChantierTitleFields({ clientId, clientName, complement, onClient, onComplement, clientError, complementError, autoFocus }: ChantierTitleFieldsProps) {
  const title = buildChantierName(clientName, complement)

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <ClientSelect value={clientId} onChange={onClient} error={clientError} />
      </div>
      <div className="sm:col-span-2">
        <Input
          label={clientName ? 'Complément du titre (facultatif)' : 'Titre du chantier'}
          placeholder={clientName ? 'Garage, terrasse, toiture…' : 'Choisis d’abord le client, ou saisis un titre'}
          value={complement}
          onChange={(e) => onComplement(e.target.value)}
          autoFocus={autoFocus}
          error={complementError}
          hint={
            title ? (
              <>
                Titre du chantier : <span className="font-medium text-gray-800">{title}</span>
              </>
            ) : (
              'Le titre reprend le nom du client ; le complément précise le lieu ou l’ouvrage.'
            )
          }
        />
      </div>
    </div>
  )
}
