import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '@/auth/AuthContext'
import { useOpenChantiers } from '@/hooks/useChantiers'
import { usePlanning } from '@/hooks/usePlanning'
import { useSubmitTimeEntries, useTimeEntries } from '@/hooks/useTimeEntries'
import { onQueueChange } from '@/lib/offlineQueue'
import { getErrorMessage } from '@/lib/errors'
import { addDays, formatRelativeDay, formatTimeRange, formatWeekRange, fromKey, isoWeek, toKey, todayKey, weekDays } from '@/lib/dates'
import { formatMinutes } from '@/lib/format'
import { toast } from '@/lib/toast'
import type { Affectation, TimeEntry } from '@/types'
import Avatar from '@/components/ui/Avatar'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Spinner from '@/components/ui/Spinner'
import CalendarToolbar from '@/components/planning/CalendarToolbar'
import ChantierSheetModal from '@/components/planning/ChantierSheetModal'
import PhotoGallery from '@/components/planning/PhotoGallery'
import SignalementModal from '@/components/planning/SignalementModal'
import TimeEntryModal from '@/components/planning/TimeEntryModal'
import type { TimeEntryTarget } from '@/components/planning/TimeEntryModal'

/**
 * Planning personnel (ouvriers, sur tablette / téléphone) : les jours de la
 * semaine avec, pour chacun, le ou les chantiers où la personne est attendue,
 * les horaires, l'adresse (itinéraire), les collègues, la consigne, et pour
 * chaque jour : pointer ses heures, signaler un imprévu, ajouter une photo.
 * En bas, le récapitulatif des heures de la semaine et l'envoi au bureau.
 */
export default function MyPlanningPage() {
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const cursorKey = searchParams.get('d') ?? todayKey()
  const cursor = useMemo(() => fromKey(cursorKey), [cursorKey])
  const days = useMemo(() => weekDays(cursor), [cursor])
  const range = useMemo(() => ({ from: toKey(days[0]), to: toKey(days[6]) }), [days])

  const { data: affectations = [], isLoading, isFetching } = usePlanning({ ...range, mine: true })
  const { data: entries = [] } = useTimeEntries(range)
  const { data: chantiers = [] } = useOpenChantiers()
  const submit = useSubmitTimeEntries()

  const [timeTarget, setTimeTarget] = useState<TimeEntryTarget | null>(null)
  const [signalFor, setSignalFor] = useState<{ affectation?: Affectation; date?: string } | null>(null)
  const [photosFor, setPhotosFor] = useState<number | null>(null)
  const [sheetFor, setSheetFor] = useState<number | null>(null)
  const [queued, setQueued] = useState(0)
  useEffect(() => onQueueChange(setQueued), [])

  const today = todayKey()
  const todays = affectations.filter((a) => a.date === today)
  const inWeek = range.from <= today && today <= range.to

  function go(key: string) {
    setSearchParams(key === today ? {} : { d: key }, { replace: true })
  }

  const byDay = useMemo(() => {
    const map = new Map<string, Affectation[]>()
    for (const a of affectations) map.set(a.date, [...(map.get(a.date) ?? []), a])
    return map
  }, [affectations])

  const entriesByDay = useMemo(() => {
    const map = new Map<string, TimeEntry[]>()
    for (const e of entries) map.set(e.date, [...(map.get(e.date) ?? []), e])
    return map
  }, [entries])

  const weekMinutes = entries.reduce((s, e) => s + e.minutes, 0)
  const plannedMinutes = affectations.reduce((s, a) => s + (a.workers.some((w) => w.id === user?.id) ? a.planned_minutes : 0), 0)
  const drafts = entries.filter((e) => e.status === 'draft')
  const firstName = user?.name.split(' ')[0] ?? ''

  function submitWeek() {
    if (drafts.length === 0) return
    submit.mutate(drafts.map((e) => e.id), {
      onSuccess: (res) => toast(res.message, 'success'),
      onError: (err) => toast(getErrorMessage(err), 'error'),
    })
  }

  const statusTone = (s: TimeEntry['status']) => (s === 'validated' ? 'success' : s === 'submitted' ? 'info' : 'neutral')

  return (
    <div className="mx-auto max-w-3xl">
      {/* Bandeau du jour */}
      <section className="mb-6 overflow-hidden rounded-card bg-gradient-to-br from-primary to-primary-hover text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.35),0_20px_50px_-20px_var(--color-primary)]">
        <div className="p-5 sm:p-6">
          <p className="text-sm text-white/75">Bonjour {firstName},</p>
          {inWeek || cursorKey === today ? (
            todays.length === 0 ? (
              <>
                <h2 className="mt-1 text-2xl font-bold tracking-tight">Rien de prévu aujourd'hui</h2>
                <p className="mt-1 text-sm text-white/70">Consulte les prochains jours ci-dessous.</p>
              </>
            ) : (
              <>
                <h2 className="mt-1 text-2xl font-bold tracking-tight">Aujourd'hui : {todays.map((a) => a.chantier.name).join(' · ')}</h2>
                <ul className="mt-3 flex flex-wrap gap-2">
                  {todays.map((a) => (
                    <li key={a.id} className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-sm backdrop-blur">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: a.equipe?.color ?? a.chantier.color }} />
                      {formatTimeRange(a.start_time, a.end_time)}
                      {a.chantier.city && <span className="text-white/70">· {a.chantier.city}</span>}
                    </li>
                  ))}
                </ul>
              </>
            )
          ) : (
            <h2 className="mt-1 text-2xl font-bold tracking-tight">Semaine {isoWeek(cursor)}</h2>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" className="bg-white/20 text-white backdrop-blur hover:bg-white/30" onClick={() => setTimeTarget(todays[0] ? { affectation: todays[0] } : { date: today })}>
              Pointer aujourd'hui
            </Button>
            <Button size="sm" variant="secondary" className="bg-white/20 text-white backdrop-blur hover:bg-white/30" onClick={() => setSignalFor({ affectation: todays[0], date: today })}>
              Signaler un imprévu
            </Button>
            {queued > 0 && <span className="self-center text-xs text-white/80">{queued} saisie(s) en attente de réseau</span>}
          </div>
        </div>
      </section>

      <CalendarToolbar
        title={formatWeekRange(cursor)}
        subtitle={`Semaine ${isoWeek(cursor)}`}
        onPrev={() => go(toKey(addDays(cursor, -7)))}
        onNext={() => go(toKey(addDays(cursor, 7)))}
        onToday={() => go(today)}
        busy={isFetching && !isLoading}
      />

      {isLoading ? (
        <Spinner block />
      ) : (
        <div className="space-y-3">
          {days.map((day) => {
            const key = toKey(day)
            const items = byDay.get(key) ?? []
            const dayEntries = entriesByDay.get(key) ?? []
            const isToday = key === today
            const isPast = key < today
            const weekend = day.getDay() === 0 || day.getDay() === 6
            if (items.length === 0 && dayEntries.length === 0 && weekend) return null
            const dayMinutes = dayEntries.reduce((s, e) => s + e.minutes, 0)

            return (
              <section
                key={key}
                className={`glass-panel overflow-hidden rounded-card ${isToday ? 'ring-2 ring-primary/50' : ''} ${
                  isPast && !isToday ? 'opacity-80' : ''
                }`}
              >
                <header className={`flex items-center gap-3 px-4 py-2.5 ${isToday ? 'bg-primary/10' : 'bg-white/30'}`}>
                  <span className={`flex h-9 w-9 items-center justify-center rounded-full text-base font-bold ${isToday ? 'bg-primary text-white gloss' : 'glass-pill text-gray-900'}`}>
                    {day.getDate()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm font-semibold ${isToday ? 'text-primary' : 'text-gray-900'}`}>{formatRelativeDay(day)}</p>
                    <p className="text-xs text-gray-500">
                      {items.length === 0 ? 'Libre' : `${items.length} chantier${items.length > 1 ? 's' : ''}`}
                      {dayMinutes > 0 && <span className="ml-2 font-medium text-gray-700">· {formatMinutes(dayMinutes)} pointées</span>}
                    </p>
                  </div>
                  {(isPast || isToday) && items.length === 0 && (
                    <Button size="sm" variant="ghost" onClick={() => setTimeTarget({ date: key })}>
                      Pointer
                    </Button>
                  )}
                </header>

                {items.length > 0 && (
                  <ul className="divide-y divide-black/[0.05]">
                    {items.map((a) => {
                      const colleagues = a.workers.filter((w) => w.id !== user?.id)
                      const isVisit = a.visitors.some((v) => v.id === user?.id)
                      const address = [a.chantier.address, a.chantier.city].filter(Boolean).join(', ')
                      const pointed = dayEntries.filter((e) => e.affectation_id === a.id)
                      return (
                        <li key={a.id} className="flex gap-3 p-4">
                          <span className="mt-1.5 h-3.5 w-3.5 shrink-0 rounded-full shadow-[inset_0_1px_0_rgb(255_255_255/0.5),0_1px_2px_rgb(0_0_0/0.15)]" style={{ backgroundColor: a.chantier.color }} aria-hidden />
                          <div className="min-w-0 flex-1 space-y-2">
                            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                              <h3 className="text-base font-semibold text-gray-900">
                                <button type="button" onClick={() => setSheetFor(a.chantier_id)} className="text-left hover:text-primary hover:underline" title="Ouvrir la fiche du chantier">
                                  {a.chantier.name}
                                </button>
                                {isVisit && <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600">passage</span>}
                                {a.phase && <span className="ml-2 text-xs font-normal text-gray-500">· {a.phase}</span>}
                                <button type="button" onClick={() => setSheetFor(a.chantier_id)} className="ml-2 align-middle text-[11px] font-medium text-primary hover:underline">
                                  Fiche
                                </button>
                              </h3>
                              <span className="rounded-md bg-gray-100 px-2 py-0.5 text-sm font-medium tabular-nums text-gray-800">{formatTimeRange(a.start_time, a.end_time)}</span>
                            </div>

                            {a.chantier.client && a.chantier.client !== a.chantier.name && <p className="text-sm text-gray-500">{a.chantier.client}</p>}

                            {address && (
                              <a
                                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
                              >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11Z" />
                                  <circle cx="12" cy="10" r="2.5" />
                                </svg>
                                {address}
                              </a>
                            )}

                            {a.note && <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">{a.note}</p>}

                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 pt-1">
                              {colleagues.length === 0 ? (
                                <span className="text-xs text-gray-400">Seul(e) sur ce chantier</span>
                              ) : (
                                colleagues.map((w) => (
                                  <span key={w.id} className="inline-flex items-center gap-1.5 text-xs text-gray-700">
                                    <Avatar name={w.name} color={w.color} size="xs" />
                                    {w.name}
                                    {w.phone && (
                                      <a href={`tel:${w.phone.replace(/\s+/g, '')}`} className="text-gray-400 hover:text-primary" aria-label={`Appeler ${w.name}`}>
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                          <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" strokeLinejoin="round" />
                                        </svg>
                                      </a>
                                    )}
                                  </span>
                                ))
                              )}
                              {a.visitors.length > 0 && !isVisit && (
                                <span className="text-xs text-gray-500">Passage : {a.visitors.map((v) => v.name.split(' ')[0]).join(', ')}</span>
                              )}
                            </div>

                            {/* Pointages liés à cette affectation */}
                            {pointed.length > 0 && (
                              <ul className="space-y-1">
                                {pointed.map((e) => (
                                  <li key={e.id} className="flex items-center justify-between gap-2 rounded-lg bg-gray-50 px-3 py-1.5 text-sm">
                                    <button type="button" onClick={() => setTimeTarget({ entry: e })} className="text-left text-gray-800 hover:underline" disabled={e.status === 'validated'}>
                                      {e.start_time} – {e.end_time}
                                      {e.break_minutes > 0 && <span className="text-gray-500"> · pause {e.break_minutes} min</span>}
                                      <span className="ml-2 font-semibold tabular-nums">{formatMinutes(e.minutes)}</span>
                                    </button>
                                    <Badge tone={statusTone(e.status)}>{e.status_label}</Badge>
                                  </li>
                                ))}
                              </ul>
                            )}

                            {(isPast || isToday) && (
                              <div className="flex flex-wrap gap-2 pt-1">
                                <Button size="sm" onClick={() => setTimeTarget({ affectation: a })} variant={pointed.length ? 'secondary' : 'primary'}>
                                  {pointed.length ? 'Pointer encore' : 'Pointer mes heures'}
                                </Button>
                                <Button size="sm" variant="secondary" onClick={() => setPhotosFor(photosFor === a.id ? null : a.id)}>
                                  Photos{a.photos_count ? ` (${a.photos_count})` : ''}
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => setSignalFor({ affectation: a })}>
                                  Imprévu
                                </Button>
                              </div>
                            )}
                            {photosFor === a.id && (
                              <div className="rounded-lg border border-gray-200 p-3">
                                <PhotoGallery affectationId={a.id} canDelete={(p) => p.user?.id === user?.id} />
                              </div>
                            )}
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                )}

                {/* Pointages libres (sans affectation) */}
                {dayEntries.filter((e) => !items.some((a) => a.id === e.affectation_id)).length > 0 && (
                  <ul className="space-y-1 border-t border-gray-100 p-3">
                    {dayEntries
                      .filter((e) => !items.some((a) => a.id === e.affectation_id))
                      .map((e) => (
                        <li key={e.id} className="flex items-center justify-between gap-2 rounded-lg bg-gray-50 px-3 py-1.5 text-sm">
                          <button type="button" onClick={() => setTimeTarget({ entry: e })} className="text-left text-gray-800 hover:underline" disabled={e.status === 'validated'}>
                            {e.chantier?.name ?? 'Sans chantier'} · {e.start_time} – {e.end_time}
                            <span className="ml-2 font-semibold tabular-nums">{formatMinutes(e.minutes)}</span>
                          </button>
                          <Badge tone={statusTone(e.status)}>{e.status_label}</Badge>
                        </li>
                      ))}
                  </ul>
                )}
              </section>
            )
          })}

          {/* Récapitulatif de la semaine */}
          <section className="rounded-card border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Mes heures de la semaine</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums text-gray-900">
                  {formatMinutes(weekMinutes)}
                  {plannedMinutes > 0 && <span className="ml-2 text-sm font-normal text-gray-500">sur {formatMinutes(plannedMinutes)} planifiées</span>}
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  {entries.filter((e) => e.status === 'validated').length} validée(s) · {entries.filter((e) => e.status === 'submitted').length} soumise(s) · {drafts.length} brouillon(s)
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" onClick={() => setTimeTarget({ date: inWeek ? today : range.from })}>
                  Ajouter des heures
                </Button>
                <Button size="sm" onClick={submitWeek} disabled={drafts.length === 0} loading={submit.isPending}>
                  Envoyer au bureau{drafts.length > 0 ? ` (${drafts.length})` : ''}
                </Button>
              </div>
            </div>
          </section>
        </div>
      )}

      <TimeEntryModal target={timeTarget} onClose={() => setTimeTarget(null)} chantiers={chantiers} />
      <SignalementModal open={signalFor !== null} onClose={() => setSignalFor(null)} affectation={signalFor?.affectation ?? null} date={signalFor?.date} />
      <ChantierSheetModal chantierId={sheetFor} onClose={() => setSheetFor(null)} />
    </div>
  )
}
