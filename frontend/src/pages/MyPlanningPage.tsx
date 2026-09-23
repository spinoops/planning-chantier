import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '@/auth/AuthContext'
import { usePlanning } from '@/hooks/usePlanning'
import { addDays, formatRelativeDay, formatTimeRange, formatWeekRange, fromKey, isoWeek, toKey, todayKey, weekDays } from '@/lib/dates'
import type { Affectation } from '@/types'
import Avatar from '@/components/ui/Avatar'
import CalendarToolbar from '@/components/planning/CalendarToolbar'
import Spinner from '@/components/ui/Spinner'

/**
 * Planning personnel (ouvriers, sur tablette / téléphone) : les jours de la
 * semaine avec, pour chacun, le ou les chantiers où la personne est attendue,
 * les horaires, l'adresse (lien vers l'itinéraire), les collègues et la consigne.
 */
export default function MyPlanningPage() {
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const cursorKey = searchParams.get('d') ?? todayKey()
  const cursor = useMemo(() => fromKey(cursorKey), [cursorKey])
  const days = useMemo(() => weekDays(cursor), [cursor])
  const range = { from: toKey(days[0]), to: toKey(days[6]), mine: true }

  const { data: affectations = [], isLoading, isFetching } = usePlanning(range)
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

  const firstName = user?.name.split(' ')[0] ?? ''

  return (
    <div className="mx-auto max-w-3xl">
      {/* Bandeau du jour */}
      <section className="mb-6 overflow-hidden rounded-card bg-gray-900 text-white shadow-md">
        <div className="p-5 sm:p-6">
          <p className="text-sm text-gray-300">Bonjour {firstName},</p>
          {inWeek || cursorKey === today ? (
            todays.length === 0 ? (
              <>
                <h2 className="mt-1 text-2xl font-semibold">Rien de prévu aujourd'hui</h2>
                <p className="mt-1 text-sm text-gray-400">Consulte les prochains jours ci-dessous.</p>
              </>
            ) : (
              <>
                <h2 className="mt-1 text-2xl font-semibold">Aujourd'hui : {todays.map((a) => a.chantier.name).join(' · ')}</h2>
                <ul className="mt-3 flex flex-wrap gap-2">
                  {todays.map((a) => (
                    <li key={a.id} className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-sm">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: a.chantier.color }} />
                      {formatTimeRange(a.start_time, a.end_time)}
                      {a.chantier.city && <span className="text-gray-300">· {a.chantier.city}</span>}
                    </li>
                  ))}
                </ul>
              </>
            )
          ) : (
            <h2 className="mt-1 text-2xl font-semibold">Semaine {isoWeek(cursor)}</h2>
          )}
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
            const isToday = key === today
            const isPast = key < today
            const weekend = day.getDay() === 0 || day.getDay() === 6
            if (items.length === 0 && weekend) return null

            return (
              <section
                key={key}
                className={`overflow-hidden rounded-card border bg-white shadow-sm ${isToday ? 'border-primary/40 ring-1 ring-primary/20' : 'border-gray-200'} ${
                  isPast && !isToday ? 'opacity-70' : ''
                }`}
              >
                <header className={`flex items-center gap-3 px-4 py-2.5 ${isToday ? 'bg-primary-soft' : 'bg-gray-50/70'}`}>
                  <span className={`flex h-9 w-9 items-center justify-center rounded-full text-base font-bold ${isToday ? 'bg-primary text-white' : 'bg-white text-gray-900 ring-1 ring-gray-200'}`}>
                    {day.getDate()}
                  </span>
                  <div>
                    <p className={`text-sm font-semibold ${isToday ? 'text-primary' : 'text-gray-900'}`}>{formatRelativeDay(day)}</p>
                    <p className="text-xs text-gray-500">{items.length === 0 ? 'Libre' : `${items.length} chantier${items.length > 1 ? 's' : ''}`}</p>
                  </div>
                </header>

                {items.length > 0 && (
                  <ul className="divide-y divide-gray-100">
                    {items.map((a) => {
                      const colleagues = a.workers.filter((w) => w.id !== user?.id)
                      const address = [a.chantier.address, a.chantier.city].filter(Boolean).join(', ')
                      return (
                        <li key={a.id} className="flex gap-3 p-4">
                          <span className="mt-1 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: a.chantier.color }} aria-hidden />
                          <div className="min-w-0 flex-1 space-y-2">
                            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                              <h3 className="text-base font-semibold text-gray-900">{a.chantier.name}</h3>
                              <span className="rounded-md bg-gray-100 px-2 py-0.5 text-sm font-medium tabular-nums text-gray-800">
                                {formatTimeRange(a.start_time, a.end_time)}
                              </span>
                            </div>

                            {a.chantier.client && <p className="text-sm text-gray-500">{a.chantier.client}</p>}

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
                            </div>
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}
