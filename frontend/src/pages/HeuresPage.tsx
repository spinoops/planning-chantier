import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useOpenChantiers } from '@/hooks/useChantiers'
import { useHoursSummary, useReopenTimeEntries, useTimeEntries, useValidateTimeEntries } from '@/hooks/useTimeEntries'
import { useWorkers } from '@/hooks/useWorkers'
import { getErrorMessage } from '@/lib/errors'
import { addDays, formatWeekRange, fromKey, isoWeek, toKey, todayKey, weekDays } from '@/lib/dates'
import { formatDate, formatMinutes } from '@/lib/format'
import { toast } from '@/lib/toast'
import type { TimeEntry } from '@/types'
import Avatar from '@/components/ui/Avatar'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import EmptyState from '@/components/ui/EmptyState'
import Select from '@/components/ui/Select'
import Spinner from '@/components/ui/Spinner'
import StatCard from '@/components/ui/StatCard'
import CalendarToolbar from '@/components/planning/CalendarToolbar'
import TimeEntryModal from '@/components/planning/TimeEntryModal'
import type { TimeEntryTarget } from '@/components/planning/TimeEntryModal'

/**
 * Heures (bureau) : synthèse de la semaine par personne et par chantier,
 * liste des pointages, validation en lot, réouverture, correction.
 */
export default function HeuresPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const cursorKey = searchParams.get('d') ?? todayKey()
  const cursor = useMemo(() => fromKey(cursorKey), [cursorKey])
  const days = useMemo(() => weekDays(cursor), [cursor])
  const range = useMemo(() => ({ from: toKey(days[0]), to: toKey(days[6]) }), [days])
  const userFilter = Number(searchParams.get('u')) || 0
  const statusFilter = (searchParams.get('s') ?? '') as TimeEntry['status'] | ''

  const { data: summary, isLoading: loadingSummary } = useHoursSummary(range)
  const { data: entries = [], isLoading, isFetching } = useTimeEntries({ ...range, user_id: userFilter || undefined, status: statusFilter })
  const { data: workers = [] } = useWorkers()
  const { data: chantiers = [] } = useOpenChantiers()
  const validate = useValidateTimeEntries()
  const reopen = useReopenTimeEntries()

  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [target, setTarget] = useState<TimeEntryTarget | null>(null)

  function setParam(key: string, value: string) {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (value) next.set(key, value)
        else next.delete(key)
        return next
      },
      { replace: true },
    )
  }

  const go = (key: string) => setParam('d', key === todayKey() ? '' : key)

  const toValidate = entries.filter((e) => e.status !== 'validated')
  const selectedIds = [...selected].filter((id) => entries.some((e) => e.id === id))

  function run(action: 'validate' | 'reopen', ids: number[]) {
    if (ids.length === 0) return
    const m = action === 'validate' ? validate : reopen
    m.mutate(ids, {
      onSuccess: (res) => {
        toast(res.message, 'success')
        setSelected(new Set())
      },
      onError: (err) => toast(getErrorMessage(err), 'error'),
    })
  }

  const tone = (s: TimeEntry['status']) => (s === 'validated' ? 'success' : s === 'submitted' ? 'info' : 'neutral')

  return (
    <div>
      <CalendarToolbar
        title={formatWeekRange(cursor)}
        subtitle={`Semaine ${isoWeek(cursor)} · heures pointées`}
        onPrev={() => go(toKey(addDays(cursor, -7)))}
        onNext={() => go(toKey(addDays(cursor, 7)))}
        onToday={() => go(todayKey())}
        busy={isFetching && !isLoading}
        filters={
          <>
            <Select value={userFilter || ''} onChange={(e) => setParam('u', e.target.value)} className="w-auto min-w-44 py-1.5" aria-label="Filtrer par personne">
              <option value="">Toute l'équipe</option>
              {workers.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </Select>
            <Select value={statusFilter} onChange={(e) => setParam('s', e.target.value)} className="w-auto min-w-40 py-1.5" aria-label="Filtrer par statut">
              <option value="">Tous les statuts</option>
              <option value="draft">Brouillon</option>
              <option value="submitted">Soumis</option>
              <option value="validated">Validé</option>
            </Select>
          </>
        }
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={() => setTarget({ date: range.from <= todayKey() && todayKey() <= range.to ? todayKey() : range.from })}>
              Saisir pour quelqu'un
            </Button>
            <Button size="sm" onClick={() => run('validate', selectedIds.length ? selectedIds : toValidate.map((e) => e.id))} loading={validate.isPending} disabled={toValidate.length === 0}>
              Valider {selectedIds.length ? `(${selectedIds.length})` : 'tout'}
            </Button>
          </>
        }
      />

      {loadingSummary || !summary ? (
        <Spinner block />
      ) : (
        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          <StatCard label="Heures pointées" value={formatMinutes(summary.totals.worked_minutes)} hint="sur la semaine" tone="primary" />
          <StatCard label="À valider" value={summary.totals.submitted} hint="soumises par les employés" tone={summary.totals.submitted ? 'warn' : 'default'} />
          <StatCard label="Brouillons" value={summary.totals.draft} hint="pas encore envoyées" />
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Par personne" description="Planifié vs pointé." flush className="lg:col-span-2">
          {summary && (
            <table className="w-full text-sm">
              <thead className="border-b border-gray-200 bg-gray-50/60 text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">Personne</th>
                  <th className="px-4 py-2 text-right font-medium">Planifié</th>
                  <th className="px-4 py-2 text-right font-medium">Pointé</th>
                  <th className="px-4 py-2 text-right font-medium">Écart</th>
                  <th className="px-4 py-2 text-right font-medium">Statuts</th>
                </tr>
              </thead>
              <tbody>
                {summary.by_user.map((row) => {
                  const diff = row.worked_minutes - row.planned_minutes
                  return (
                    <tr key={row.user.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                      <td className="px-4 py-2">
                        <button type="button" onClick={() => setParam('u', String(row.user.id))} className="flex items-center gap-2 text-left">
                          <Avatar name={row.user.name} color={row.user.color} size="sm" />
                          <span>
                            <span className="block font-medium text-gray-900">{row.user.name}</span>
                            <span className="block text-xs text-gray-500">{row.user.job_title ?? '—'}</span>
                          </span>
                        </button>
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums text-gray-600">{formatMinutes(row.planned_minutes)}</td>
                      <td className="px-4 py-2 text-right font-medium tabular-nums text-gray-900">{formatMinutes(row.worked_minutes)}</td>
                      <td className={`px-4 py-2 text-right tabular-nums ${diff > 0 ? 'text-amber-600' : diff < 0 ? 'text-gray-500' : 'text-gray-400'}`}>
                        {row.entries === 0 ? '—' : `${diff > 0 ? '+' : diff < 0 ? '−' : ''}${formatMinutes(Math.abs(diff))}`}
                      </td>
                      <td className="px-4 py-2 text-right text-xs text-gray-500">
                        {row.validated > 0 && <span className="ml-1 text-green-700">{row.validated} ✓</span>}
                        {row.submitted > 0 && <span className="ml-1 text-blue-700">{row.submitted} soumis</span>}
                        {row.draft > 0 && <span className="ml-1">{row.draft} brouillon</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </Card>

        <Card title="Par chantier" description="Heures pointées cette semaine." flush>
          {summary?.by_chantier.length ? (
            <ul className="divide-y divide-gray-100">
              {summary.by_chantier.map((row) => (
                <li key={row.chantier.id} className="flex items-center gap-3 px-4 py-2.5">
                  <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: row.chantier.color }} />
                  <span className="min-w-0 flex-1 truncate text-sm text-gray-800">{row.chantier.name}</span>
                  <span className="text-sm font-semibold tabular-nums text-gray-900">{formatMinutes(row.worked_minutes)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="Aucune heure pointée." />
          )}
        </Card>
      </div>

      <Card
        title="Pointages"
        description="Clique une ligne pour corriger. Coche pour valider ou rouvrir en lot."
        className="mt-6"
        flush
        action={
          selectedIds.length > 0 && (
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" onClick={() => run('reopen', selectedIds)} loading={reopen.isPending}>
                Rouvrir ({selectedIds.length})
              </Button>
              <Button size="sm" onClick={() => run('validate', selectedIds)} loading={validate.isPending}>
                Valider ({selectedIds.length})
              </Button>
            </div>
          )
        }
      >
        {isLoading ? (
          <Spinner block />
        ) : entries.length === 0 ? (
          <EmptyState title="Aucun pointage sur cette période." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-200 bg-gray-50/60 text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-2">
                    <input
                      type="checkbox"
                      aria-label="Tout sélectionner"
                      checked={selectedIds.length === entries.length && entries.length > 0}
                      onChange={(e) => setSelected(e.target.checked ? new Set(entries.map((x) => x.id)) : new Set())}
                      className="h-4 w-4 rounded border-gray-300 accent-primary"
                    />
                  </th>
                  <th className="px-4 py-2 text-left font-medium">Jour</th>
                  <th className="px-4 py-2 text-left font-medium">Personne</th>
                  <th className="px-4 py-2 text-left font-medium">Chantier</th>
                  <th className="px-4 py-2 text-left font-medium">Horaire</th>
                  <th className="px-4 py-2 text-right font-medium">Durée</th>
                  <th className="px-4 py-2 text-left font-medium">Statut</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                    <td className="px-4 py-2">
                      <input
                        type="checkbox"
                        aria-label="Sélectionner"
                        checked={selected.has(e.id)}
                        onChange={(ev) =>
                          setSelected((prev) => {
                            const next = new Set(prev)
                            if (ev.target.checked) next.add(e.id)
                            else next.delete(e.id)
                            return next
                          })
                        }
                        className="h-4 w-4 rounded border-gray-300 accent-primary"
                      />
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap text-gray-700">{formatDate(e.date)}</td>
                    <td className="px-4 py-2">
                      <span className="flex items-center gap-2">
                        {e.user && <Avatar name={e.user.name} color={e.user.color} size="xs" />}
                        <span className="text-gray-900">{e.user?.name ?? '—'}</span>
                      </span>
                    </td>
                    <td className="px-4 py-2 text-gray-700">
                      {e.chantier?.name ?? <span className="italic text-gray-400">Sans chantier</span>}
                      {e.comment && <span className="block truncate text-xs italic text-gray-500" title={e.comment}>{e.comment}</span>}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap">
                      <button type="button" onClick={() => setTarget({ entry: e })} className="text-gray-800 hover:underline">
                        {e.start_time} – {e.end_time}
                        {e.break_minutes > 0 && <span className="text-xs text-gray-500"> · pause {e.break_minutes}</span>}
                      </button>
                    </td>
                    <td className="px-4 py-2 text-right font-medium tabular-nums">{formatMinutes(e.minutes)}</td>
                    <td className="px-4 py-2">
                      <Badge tone={tone(e.status)}>{e.status_label}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <TimeEntryModal target={target} onClose={() => setTarget(null)} chantiers={chantiers} userId={userFilter || undefined} />
    </div>
  )
}
