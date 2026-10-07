import { useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useEquipes } from '@/hooks/useEquipes'
import { usePlanning } from '@/hooks/usePlanning'
import { useSettings } from '@/hooks/useSettings'
import { formatTimeRange, formatWeekRange, formatWeekdayLong, fromKey, isoWeek, toKey, todayKey, weekDays } from '@/lib/dates'
import { formatDate } from '@/lib/format'
import type { Affectation } from '@/types'
import Button from '@/components/ui/Button'
import Spinner from '@/components/ui/Spinner'

/**
 * Vue imprimable de la semaine : une page par équipe (ou une seule équipe via
 * ?equipe=), jours en lignes, chantier / adresse / horaire / consigne.
 * S'ouvre depuis le planning ; Ctrl+P ou le bouton « Imprimer ».
 */
export default function PrintWeekPage() {
  const [searchParams] = useSearchParams()
  const cursor = useMemo(() => fromKey(searchParams.get('d') ?? todayKey()), [searchParams])
  const equipeFilter = Number(searchParams.get('equipe')) || 0
  const days = useMemo(() => weekDays(cursor), [cursor])
  const range = { from: toKey(days[0]), to: toKey(days[6]) }

  const { data: affectations = [], isLoading } = usePlanning(range)
  const { data: equipes = [] } = useEquipes()
  const { data: settings } = useSettings()

  useEffect(() => {
    document.body.classList.add('print-page')
    return () => document.body.classList.remove('print-page')
  }, [])

  const groups = useMemo(() => {
    const list = equipeFilter ? equipes.filter((e) => e.id === equipeFilter) : equipes
    const byTeam = list.map((e) => ({ key: String(e.id), name: e.name, color: e.color, members: e.members.map((m) => m.name).join(', '), items: affectations.filter((a) => a.equipe_id === e.id) }))
    const none = affectations.filter((a) => !a.equipe_id)
    if (!equipeFilter && none.length) byTeam.push({ key: 'none', name: 'Sans équipe', color: '#9ca3af', members: '', items: none })
    return byTeam.filter((g) => g.items.length > 0 || equipeFilter)
  }, [equipes, affectations, equipeFilter])

  if (isLoading) return <Spinner block />

  return (
    <div className="print-root mx-auto max-w-4xl">
      <div className="print:hidden mb-4 flex items-center justify-between gap-3 rounded-card border border-gray-200 bg-white px-4 py-3 shadow-sm">
        <p className="text-sm text-gray-600">
          Aperçu d'impression · {groups.length} page{groups.length > 1 ? 's' : ''} (une par équipe). Format A4 portrait.
        </p>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => window.history.back()}>
            Retour
          </Button>
          <Button size="sm" onClick={() => window.print()}>
            Imprimer
          </Button>
        </div>
      </div>

      {groups.length === 0 && <p className="rounded-card border border-gray-200 bg-white p-6 text-center text-sm text-gray-500">Aucune affectation cette semaine.</p>}

      {groups.map((g) => (
        <section key={g.key} className="print-sheet mb-6 rounded-card border border-gray-200 bg-white p-6 shadow-sm print:mb-0 print:rounded-none print:border-0 print:p-0 print:shadow-none">
          <header className="mb-4 flex items-start justify-between gap-4 border-b-2 pb-3" style={{ borderColor: g.color }}>
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-500">{settings?.app_name ?? 'Planning'}</p>
              <h1 className="text-2xl font-bold text-gray-900">
                <span className="mr-2 inline-block h-4 w-4 rounded-full align-middle" style={{ backgroundColor: g.color }} />
                {g.name}
              </h1>
              {g.members && <p className="text-sm text-gray-600">{g.members}</p>}
            </div>
            <div className="text-right">
              <p className="text-lg font-semibold text-gray-900">Semaine {isoWeek(cursor)}</p>
              <p className="text-sm text-gray-600">{formatWeekRange(cursor)}</p>
            </div>
          </header>

          <table className="w-full border-collapse text-sm">
            <tbody>
              {days.slice(0, 6).map((day) => {
                const key = toKey(day)
                const items = g.items.filter((a) => a.date === key)
                const isSat = day.getDay() === 6
                if (isSat && items.length === 0) return null
                return (
                  <tr key={key} className="border-b border-gray-200 align-top">
                    <th className="w-32 py-2 pr-3 text-left font-semibold text-gray-900">
                      {formatWeekdayLong(day)}
                      <span className="block text-xs font-normal text-gray-500">{formatDate(key)}</span>
                    </th>
                    <td className="py-2">
                      {items.length === 0 ? (
                        <span className="text-gray-400">—</span>
                      ) : (
                        <ul className="space-y-1.5">
                          {items.map((a: Affectation) => (
                            <li key={a.id} className="flex gap-3">
                              <span className="w-24 shrink-0 font-medium tabular-nums text-gray-800">{formatTimeRange(a.start_time, a.end_time)}</span>
                              <span className="min-w-0">
                                <span className="font-semibold text-gray-900">{a.chantier.name}</span>
                                {a.phase && <span className="text-gray-600"> · {a.phase}</span>}
                                {(a.chantier.address || a.chantier.city) && (
                                  <span className="block text-gray-600">{[a.chantier.address, a.chantier.city].filter(Boolean).join(', ')}</span>
                                )}
                                {a.workers.length > 0 && g.key === 'none' && <span className="block text-xs text-gray-500">{a.workers.map((w) => w.name).join(', ')}</span>}
                                {a.visitors.length > 0 && <span className="block text-xs text-gray-500">Passage : {a.visitors.map((v) => v.name).join(', ')}</span>}
                                {a.note && <span className="block text-xs italic text-gray-700">{a.note}</span>}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <p className="mt-4 text-[10px] text-gray-400">Imprimé le {formatDate(todayKey())}</p>
        </section>
      ))}
    </div>
  )
}
