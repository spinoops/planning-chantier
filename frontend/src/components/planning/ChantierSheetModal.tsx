import { Link } from 'react-router-dom'
import { useAuth } from '@/auth/AuthContext'
import { useChantier } from '@/hooks/useChantiers'
import { formatDate } from '@/lib/format'
import { isPlanner } from '@/lib/navigation'
import Badge from '@/components/ui/Badge'
import Modal from '@/components/ui/Modal'
import Spinner from '@/components/ui/Spinner'

interface ChantierSheetModalProps {
  chantierId: number | null
  onClose: () => void
}

/**
 * Fiche chantier en lecture (vue employé, et aperçu depuis le planning) :
 * client et contact, adresse (itinéraire), matériel prévu, mesures,
 * sous-traitants, remarques. Les planificateurs ont un lien vers la fiche complète.
 */
export default function ChantierSheetModal({ chantierId, onClose }: ChantierSheetModalProps) {
  const { user } = useAuth()
  const { data: c, isLoading } = useChantier(chantierId)
  const address = c ? [c.address, c.city].filter(Boolean).join(', ') : ''

  return (
    <Modal open={chantierId !== null} onClose={onClose} title={c?.name ?? 'Chantier'} size="lg">
      {isLoading || !c ? (
        <Spinner block />
      ) : (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="h-3 w-3 rounded-full" style={{ backgroundColor: c.color }} />
            <Badge tone={c.status === 'active' ? 'success' : c.status === 'planned' ? 'info' : 'neutral'}>{c.status_label}</Badge>
            {(c.start_date || c.end_date) && (
              <span className="text-xs text-gray-500">
                {formatDate(c.start_date)} → {formatDate(c.end_date)}
              </span>
            )}
            {isPlanner(user) && (
              <Link to={`/chantiers/${c.id}`} className="ml-auto text-sm font-medium text-primary hover:underline" onClick={onClose}>
                Ouvrir la fiche complète
              </Link>
            )}
          </div>

          <section className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg border border-gray-200 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Client</p>
              <p className="mt-1 text-sm font-medium text-gray-900">{c.client_record?.name ?? c.client ?? '—'}</p>
              {c.client_record?.contact_name && <p className="text-sm text-gray-600">{c.client_record.contact_name}</p>}
              {c.client_record?.phone && (
                <a href={`tel:${c.client_record.phone.replace(/\s+/g, '')}`} className="mt-1 inline-block text-sm text-primary hover:underline">
                  {c.client_record.phone}
                </a>
              )}
            </div>
            <div className="rounded-lg border border-gray-200 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Adresse</p>
              {address ? (
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 inline-block text-sm text-primary hover:underline"
                >
                  {address}
                </a>
              ) : (
                <p className="mt-1 text-sm text-gray-400">Non renseignée</p>
              )}
            </div>
          </section>

          {c.materiel.length > 0 && (
            <section>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Matériel prévu</p>
              <ul className="mt-1.5 divide-y divide-gray-100 rounded-lg border border-gray-200">
                {c.materiel.map((m, i) => (
                  <li key={i} className="flex items-center gap-2 px-3 py-1.5 text-sm">
                    <span className={`flex h-4 w-4 items-center justify-center rounded border text-[10px] ${m.done ? 'border-green-600 bg-green-600 text-white' : 'border-gray-300'}`}>{m.done ? '✓' : ''}</span>
                    <span className={m.done ? 'text-gray-500 line-through' : 'text-gray-900'}>{m.label}</span>
                    {m.qty && <span className="ml-auto text-xs text-gray-500">{m.qty}</span>}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {c.mesures && (
            <section>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Mesures</p>
              <p className="mt-1 whitespace-pre-wrap rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-800">{c.mesures}</p>
              {c.remeasure_needed && !c.remeasured_at && <p className="mt-1 text-xs font-medium text-amber-700">Mesures à reprendre sur place.</p>}
            </section>
          )}

          {(c.sous_traitants?.length ?? 0) > 0 && (
            <section>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Sous-traitants prévus</p>
              <ul className="mt-1.5 space-y-1">
                {c.sous_traitants!.map((s) => (
                  <li key={s.id} className="flex flex-wrap items-baseline gap-x-2 text-sm">
                    <span className="font-medium text-gray-900">{s.name}</span>
                    {s.trade && <span className="text-gray-500">{s.trade}</span>}
                    {s.phone && (
                      <a href={`tel:${s.phone.replace(/\s+/g, '')}`} className="text-primary hover:underline">
                        {s.phone}
                      </a>
                    )}
                    {(s.note || s.planned_date) && (
                      <span className="text-xs text-gray-500">
                        {s.planned_date ? formatDate(s.planned_date) : ''}
                        {s.planned_date && s.note ? ' · ' : ''}
                        {s.note}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {c.notes && (
            <section>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Remarques</p>
              <p className="mt-1 whitespace-pre-wrap rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">{c.notes}</p>
            </section>
          )}
        </div>
      )}
    </Modal>
  )
}
