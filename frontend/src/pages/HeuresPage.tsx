import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAbsences } from '@/hooks/useAbsences'
import { useOpenChantiers } from '@/hooks/useChantiers'
import { usePlanning } from '@/hooks/usePlanning'
import { downloadHoursCsv, useHoursSummary, useReopenTimeEntries, useTimeEntries, useValidateTimeEntries } from '@/hooks/useTimeEntries'
import { getErrorMessage } from '@/lib/errors'
import { addDays, addMonths, formatLongDay, formatMonthYear, formatTimeRange, formatWeekRange, formatWeekdayShort, fromKey, isoWeek, startOfMonth, toKey, todayKey, weekDays } from '@/lib/dates'
import { formatDate, formatMinutes } from '@/lib/format'
import { toast } from '@/lib/toast'
import type { Absence, HoursCell, HoursSummary, TimeEntry } from '@/types'
import Avatar from '@/components/ui/Avatar'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import EmptyState from '@/components/ui/EmptyState'
import PageHeader from '@/components/ui/PageHeader'
import Spinner from '@/components/ui/Spinner'
import TimeEntryModal from '@/components/planning/TimeEntryModal'
import type { TimeEntryTarget } from '@/components/planning/TimeEntryModal'

type Period = 'week' | 'month'
type StatusFilter = '' | TimeEntry['status']
type Person = HoursSummary['by_user'][number]['user']

/** Journée de plus de 10 h : à contrôler. */
const LONG_DAY = 600
/** Écart toléré entre pointé et planifié avant de le signaler. */
const GAP_TOLERANCE = 90

const PILL = 'glass-pill inline-flex items-center justify-center rounded-full text-gray-800 active:scale-95'

/** « +1h30 », « −45 min », « 0h ». */
function signed(minutes: number): string {
  if (minutes === 0) return '0h'
  return `${minutes > 0 ? '+' : '−'}${formatMinutes(Math.abs(minutes))}`
}

function minutesOf(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

function statusTone(s: TimeEntry['status']) {
  return s === 'validated' ? 'success' : s === 'submitted' ? 'info' : 'neutral'
}

function daysBetween(from: string, to: string): string[] {
  const out: string[] = []
  for (let d = fromKey(from); toKey(d) <= to; d = addDays(d, 1)) out.push(toKey(d))
  return out
}

function absenceOn(absences: Absence[], userId: number, date: string): Absence | undefined {
  return absences.find((a) => a.user_id === userId && a.start_date <= date && a.end_date >= date)
}

interface Anomaly {
  key: string
  userId: number
  date: string
  kind: 'missing' | 'long' | 'overlap' | 'nochantier' | 'gap'
  label: string
}

const ANOMALY_TONE: Record<Anomaly['kind'], string> = {
  missing: 'bg-sys-red',
  long: 'bg-sys-orange',
  overlap: 'bg-sys-red',
  nochantier: 'bg-gray-400',
  gap: 'bg-sys-orange',
}

/* ------------------------------------------------------------------------- */

function Kpi({ label, value, hint, color, progress, children }: { label: string; value: ReactNode; hint?: ReactNode; color: string; progress?: number; children?: ReactNode }) {
  return (
    <div className="glass-panel flex min-h-28 flex-col justify-between rounded-card p-4">
      <div className="flex items-start justify-between gap-2">
        <span className="text-[12px] font-semibold uppercase tracking-wide text-gray-500">{label}</span>
        <span className="mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} aria-hidden />
      </div>
      <div>
        <p className="text-[26px] font-bold leading-none tracking-tight tabular-nums text-gray-900">{value}</p>
        {progress !== undefined && (
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-gray-900/[0.07]">
            <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, Math.max(0, progress))}%`, backgroundColor: color }} />
          </div>
        )}
        {hint && <p className="mt-1.5 text-xs text-gray-500">{hint}</p>}
        {children}
      </div>
    </div>
  )
}

/** Une case de la feuille d'heures (personne × jour). */
function SheetCell({
  cell,
  absence,
  past,
  compact,
  selected,
  flagged,
  onClick,
}: {
  cell?: HoursCell
  absence?: Absence
  past: boolean
  compact: boolean
  selected: boolean
  flagged: boolean
  onClick: () => void
}) {
  const worked = cell?.worked_minutes ?? 0
  const planned = cell?.planned_minutes ?? 0
  const hasEntries = (cell?.entries ?? 0) > 0
  const missing = !hasEntries && (cell?.planned ?? 0) > 0 && past && !absence

  let tone = 'text-gray-300'
  let label: ReactNode = '·'
  if (hasEntries) {
    if (cell!.submitted > 0) tone = 'bg-sys-blue/15 text-sys-blue-deep'
    else if (cell!.draft > 0) tone = 'bg-gray-900/[0.07] text-gray-800'
    else tone = 'bg-sys-green/18 text-sys-green-deep'
    label = formatMinutes(worked)
  } else if (absence) {
    tone = 'bg-gray-900/[0.05] text-gray-500 italic'
    label = compact ? absence.type_label.slice(0, 3) + '.' : absence.type_label
  } else if (missing) {
    tone = 'bg-sys-red/10 text-sys-red ring-1 ring-inset ring-sys-red/40'
    label = 'Oubli'
  } else if ((cell?.planned ?? 0) > 0) {
    tone = 'text-gray-400'
    label = compact ? formatMinutes(planned) : `${formatMinutes(planned)} prévu`
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative flex h-full min-h-11 w-full flex-col items-center justify-center rounded-xl px-1 text-center transition hover:ring-2 hover:ring-primary/40 ${tone} ${
        selected ? 'ring-2 ring-primary' : ''
      }`}
    >
      <span className={`font-semibold tabular-nums ${compact ? 'text-[11px]' : 'text-[13px]'}`}>{label}</span>
      {hasEntries && planned > 0 && !compact && <span className="text-[10px] font-normal opacity-70">/ {formatMinutes(planned)}</span>}
      {flagged && hasEntries && <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-sys-orange" aria-label="À contrôler" />}
    </button>
  )
}

/* ------------------------------------------------------------------------- */

/**
 * Statistiques → Heures (bureau / chefs) : indicateurs de la période, feuille
 * d'heures personne × jour (pointé, prévu, oublis, absences), détail d'une
 * journée avec correction, validation et pointage à la place de l'employé,
 * anomalies à contrôler, heures par chantier, liste des pointages, export CSV.
 */
export default function HeuresPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const period: Period = searchParams.get('p') === 'month' ? 'month' : 'week'
  const cursorKey = searchParams.get('d') ?? todayKey()
  const cursor = useMemo(() => fromKey(cursorKey), [cursorKey])
  const userFilter = Number(searchParams.get('u')) || 0
  const statusFilter = (searchParams.get('s') ?? '') as StatusFilter
  const today = todayKey()

  const range = useMemo(() => {
    if (period === 'month') {
      const first = startOfMonth(cursor)
      return { from: toKey(first), to: toKey(addDays(addMonths(first, 1), -1)) }
    }
    const days = weekDays(cursor)
    return { from: toKey(days[0]), to: toKey(days[6]) }
  }, [cursor, period])
  const days = useMemo(() => daysBetween(range.from, range.to), [range])
  const compact = period === 'month'

  const { data: summary, isLoading: loadingSummary, isFetching } = useHoursSummary(range)
  const { data: entries = [], isLoading: loadingEntries } = useTimeEntries(range)
  const { data: absences = [] } = useAbsences(range)
  const { data: chantiers = [] } = useOpenChantiers()
  const validate = useValidateTimeEntries()
  const reopen = useReopenTimeEntries()

  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [day, setDay] = useState<{ userId: number; date: string } | null>(null)
  const [target, setTarget] = useState<{ t: TimeEntryTarget; userId: number; name: string } | null>(null)
  const [exporting, setExporting] = useState(false)
  const dayRef = useRef<HTMLDivElement>(null)

  function setParams(patch: Record<string, string | null>) {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        for (const [k, v] of Object.entries(patch)) {
          if (v) next.set(k, v)
          else next.delete(k)
        }
        return next
      },
      { replace: true },
    )
  }

  const go = (d: Date) => {
    const key = toKey(d)
    setParams({ d: key === today ? null : key })
    setDay(null)
  }
  const prev = () => go(period === 'month' ? addMonths(startOfMonth(cursor), -1) : addDays(cursor, -7))
  const next = () => go(period === 'month' ? addMonths(startOfMonth(cursor), 1) : addDays(cursor, 7))

  /* ------------------------------------------------------------ données dérivées */

  const people: Person[] = useMemo(() => (summary?.by_user ?? []).map((r) => r.user), [summary])
  const rows = useMemo(() => (summary?.by_user ?? []).filter((r) => !userFilter || r.user.id === userFilter), [summary, userFilter])
  const nameOf = (id: number) => people.find((p) => p.id === id)?.name ?? 'Employé'

  const cells = useMemo(() => {
    const map = new Map<string, HoursCell>()
    for (const c of summary?.grid ?? []) map.set(`${c.user_id}|${c.date}`, c)
    return map
  }, [summary])

  const entriesByCell = useMemo(() => {
    const map = new Map<string, TimeEntry[]>()
    for (const e of entries) {
      const k = `${e.user_id}|${e.date}`
      map.set(k, [...(map.get(k) ?? []), e])
    }
    return map
  }, [entries])

  // Planifié « à ce jour » : jours passés, plus aujourd'hui si la personne a déjà pointé.
  // Comparer le pointé à tout le planifié de la période (jours à venir compris) fausserait l'écart.
  const plannedToDate = useMemo(() => {
    const map = new Map<number, number>()
    for (const c of summary?.grid ?? []) {
      if (c.date < today || (c.date === today && c.entries > 0)) map.set(c.user_id, (map.get(c.user_id) ?? 0) + c.planned_minutes)
    }
    return map
  }, [summary, today])

  const anomalies = useMemo(() => {
    const list: Anomaly[] = []
    for (const c of summary?.grid ?? []) {
      if (userFilter && c.user_id !== userFilter) continue
      const k = `${c.user_id}|${c.date}`
      const name = nameOf(c.user_id).split(' ')[0]
      const absent = absenceOn(absences, c.user_id, c.date)
      if (c.planned > 0 && c.entries === 0 && c.date < today && !absent) {
        list.push({ key: `${k}|missing`, userId: c.user_id, date: c.date, kind: 'missing', label: `${name} n'a pas pointé (${formatMinutes(c.planned_minutes)} prévues)` })
      }
      if (c.worked_minutes > LONG_DAY) {
        list.push({ key: `${k}|long`, userId: c.user_id, date: c.date, kind: 'long', label: `${name} : journée de ${formatMinutes(c.worked_minutes)}` })
      }
      if (c.entries > 0 && c.planned_minutes > 0 && Math.abs(c.worked_minutes - c.planned_minutes) > GAP_TOLERANCE) {
        list.push({ key: `${k}|gap`, userId: c.user_id, date: c.date, kind: 'gap', label: `${name} : ${signed(c.worked_minutes - c.planned_minutes)} par rapport au planning` })
      }
      const dayEntries = [...(entriesByCell.get(k) ?? [])].sort((a, b) => a.start_time.localeCompare(b.start_time))
      for (let i = 1; i < dayEntries.length; i++) {
        if (minutesOf(dayEntries[i].start_time) < minutesOf(dayEntries[i - 1].end_time)) {
          list.push({ key: `${k}|overlap`, userId: c.user_id, date: c.date, kind: 'overlap', label: `${name} : deux pointages se chevauchent` })
          break
        }
      }
      if (dayEntries.some((e) => !e.chantier_id)) {
        list.push({ key: `${k}|nochantier`, userId: c.user_id, date: c.date, kind: 'nochantier', label: `${name} : heures sans chantier` })
      }
    }
    return list.sort((a, b) => a.date.localeCompare(b.date))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [summary, entriesByCell, absences, userFilter, today])
  const flaggedCells = useMemo(() => new Set(anomalies.filter((a) => a.kind !== 'missing').map((a) => `${a.userId}|${a.date}`)), [anomalies])

  const visibleEntries = useMemo(
    () => entries.filter((e) => (!userFilter || e.user_id === userFilter) && (!statusFilter || e.status === statusFilter)),
    [entries, userFilter, statusFilter],
  )
  const selectedIds = [...selected].filter((id) => visibleEntries.some((e) => e.id === id))

  // Totaux de la période (filtrés sur la personne si besoin).
  const totals = useMemo(() => {
    const sum = (f: (r: HoursSummary['by_user'][number]) => number) => rows.reduce((s, r) => s + f(r), 0)
    return {
      worked: sum((r) => r.worked_minutes),
      planned: sum((r) => r.planned_minutes),
      plannedToDate: sum((r) => plannedToDate.get(r.user.id) ?? 0),
      validated: sum((r) => r.validated_minutes),
      submitted: sum((r) => r.submitted),
      submittedMinutes: sum((r) => r.submitted_minutes),
      draft: sum((r) => r.draft),
      missing: sum((r) => r.missing_days),
    }
  }, [rows, plannedToDate])

  /* ---------------------------------------------------------------- actions */

  function run(action: 'validate' | 'reopen', ids: number[], done?: () => void) {
    if (ids.length === 0) return
    const m = action === 'validate' ? validate : reopen
    m.mutate(ids, {
      onSuccess: (res) => {
        toast(res.message, 'success')
        setSelected(new Set())
        done?.()
      },
      onError: (err) => toast(getErrorMessage(err), 'error'),
    })
  }

  const pendingIdsOf = (userId: number) => entries.filter((e) => e.user_id === userId && e.status !== 'validated').map((e) => e.id)
  const allPending = entries.filter((e) => (!userFilter || e.user_id === userFilter) && e.status === 'submitted').map((e) => e.id)

  function openDay(userId: number, date: string) {
    setDay((cur) => (cur && cur.userId === userId && cur.date === date ? null : { userId, date }))
  }

  useEffect(() => {
    if (day) dayRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [day])

  async function exportCsv() {
    setExporting(true)
    try {
      await downloadHoursCsv(range, userFilter || undefined)
    } catch (err) {
      toast(getErrorMessage(err, 'Export impossible.'), 'error')
    } finally {
      setExporting(false)
    }
  }

  const title = period === 'month' ? formatMonthYear(cursor) : formatWeekRange(cursor)
  const loading = loadingSummary || loadingEntries

  return (
    <div>
      <PageHeader
        title="Heures"
        subtitle="Statistiques · contrôle, correction et validation des heures des employés."
        action={
          <>
            <Button variant="secondary" onClick={() => void exportCsv()} loading={exporting}>
              Exporter CSV
            </Button>
            <Button onClick={() => setTarget({ t: { date: range.from <= today && today <= range.to ? today : range.from }, userId: userFilter || people[0]?.id || 0, name: nameOf(userFilter || people[0]?.id || 0) })} disabled={people.length === 0}>
              + Saisir des heures
            </Button>
          </>
        }
      />

      {/* Période et filtres */}
      <div className="mb-4 flex flex-wrap items-center gap-2 sm:gap-3">
        <div className="flex items-center gap-1">
          <button type="button" onClick={prev} aria-label="Période précédente" className={`${PILL} h-8 w-8`}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6">
              <path d="m15 6-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <button type="button" onClick={() => go(new Date())} className={`${PILL} h-8 px-3.5 text-[13px] font-medium`}>
            Aujourd'hui
          </button>
          <button type="button" onClick={next} aria-label="Période suivante" className={`${PILL} h-8 w-8`}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6">
              <path d="m9 6 6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
        <div className="flex min-w-0 items-baseline gap-2">
          <h2 className="truncate text-[20px] font-bold capitalize tracking-tight text-gray-900">{title}</h2>
          {period === 'week' && <span className="hidden text-[13px] text-gray-500 sm:inline">Semaine {isoWeek(cursor)}</span>}
          {isFetching && !loading && <span className="h-3 w-3 animate-spin rounded-full border-2 border-gray-300 border-t-primary" aria-label="Chargement" />}
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-full bg-white/35 p-1 shadow-[inset_0_1px_2px_rgb(15_40_90/0.08),inset_0_0_0_1px_rgb(255_255_255/0.4)]" role="tablist" aria-label="Période">
            {(
              [
                ['week', 'Semaine'],
                ['month', 'Mois'],
              ] as const
            ).map(([v, l]) => (
              <button
                key={v}
                type="button"
                role="tab"
                aria-selected={period === v}
                onClick={() => {
                  setParams({ p: v === 'week' ? null : v })
                  setDay(null)
                }}
                className={`whitespace-nowrap rounded-full px-3.5 py-1 text-[13px] font-medium transition ${
                  period === v ? 'bg-white text-gray-900 shadow-[0_1px_3px_rgb(15_40_90/0.15),inset_0_1px_0_rgb(255_255_255)]' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {l}
              </button>
            ))}
          </div>
          <select
            value={userFilter || ''}
            onChange={(e) => {
              setParams({ u: e.target.value || null })
              setDay(null)
            }}
            aria-label="Filtrer par employé"
            className="glass-pill rounded-full py-1.5 pl-3 pr-8 text-[13px] font-medium"
          >
            <option value="">Toute l'équipe</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading || !summary ? (
        <Spinner block />
      ) : (
        <div className="space-y-6">
          {/* Indicateurs */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <Kpi
              label="Pointées"
              value={formatMinutes(totals.worked)}
              hint={totals.plannedToDate ? `sur ${formatMinutes(totals.plannedToDate)} planifiées à ce jour` : totals.planned ? `${formatMinutes(totals.planned)} planifiées à venir` : 'rien de planifié'}
              color="var(--color-primary)"
              progress={totals.plannedToDate ? (totals.worked / totals.plannedToDate) * 100 : undefined}
            />
            <Kpi
              label="Écart"
              value={totals.worked || totals.plannedToDate ? signed(totals.worked - totals.plannedToDate) : '—'}
              hint="pointé − planifié à ce jour"
              color={totals.worked >= totals.plannedToDate ? '#34c759' : '#ff9500'}
            />
            <Kpi label="À valider" value={totals.submitted} hint={`${formatMinutes(totals.submittedMinutes)} soumises`} color="#007aff">
              {allPending.length > 0 && (
                <button type="button" onClick={() => run('validate', allPending)} className="mt-2 text-xs font-semibold text-primary hover:underline" disabled={validate.isPending}>
                  Tout valider
                </button>
              )}
            </Kpi>
            <Kpi label="Validées" value={formatMinutes(totals.validated)} hint={totals.draft ? `${totals.draft} brouillon(s) non envoyé(s)` : 'aucun brouillon'} color="#34c759" />
            <Kpi label="Oublis de pointage" value={totals.missing} hint={totals.missing ? 'jours planifiés sans heures' : 'tout est pointé'} color={totals.missing ? '#ff3b30' : '#34c759'} />
          </div>

          {/* Feuille d'heures */}
          <Card title="Feuille d'heures" description="Une case par personne et par jour. Clique une case pour voir, corriger ou valider la journée." flush>
            {rows.length === 0 ? (
              <EmptyState title="Personne à afficher." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-separate border-spacing-0 text-sm">
                  <thead>
                    <tr className="text-[12px] text-gray-500">
                      <th className="sticky left-0 z-10 min-w-48 bg-white/70 px-4 py-2 text-left font-medium backdrop-blur">Employé</th>
                      {days.map((d) => {
                        const date = fromKey(d)
                        const isToday = d === today
                        const weekend = date.getDay() === 0 || date.getDay() === 6
                        return (
                          <th key={d} className={`px-1 py-2 text-center font-medium ${compact ? 'min-w-11' : 'min-w-20'} ${weekend ? 'text-gray-400' : ''}`}>
                            <span className={`block text-[11px] ${isToday ? 'font-bold text-sys-red' : ''}`}>{compact ? formatWeekdayShort(date).slice(0, 2) : formatWeekdayShort(date)}</span>
                            <span
                              className={`mx-auto mt-0.5 flex h-6 w-6 items-center justify-center rounded-full text-[12px] tabular-nums ${isToday ? 'bg-sys-red font-bold text-white' : 'text-gray-700'}`}
                            >
                              {date.getDate()}
                            </span>
                          </th>
                        )
                      })}
                      <th className="px-3 py-2 text-right font-medium">Pointé</th>
                      <th className="px-3 py-2 text-right font-medium">Prévu</th>
                      <th className="px-3 py-2 text-right font-medium" title="Pointé − planifié à ce jour">
                        Écart
                      </th>
                      <th className="px-3 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => {
                      const toDate = plannedToDate.get(r.user.id) ?? 0
                      const diff = r.worked_minutes - toDate
                      const pending = pendingIdsOf(r.user.id)
                      return (
                        <tr key={r.user.id} className="group">
                          <td className="sticky left-0 z-10 border-t border-black/[0.05] bg-white/70 px-4 py-2 backdrop-blur">
                            <button type="button" onClick={() => setParams({ u: userFilter === r.user.id ? null : String(r.user.id) })} className="flex items-center gap-2.5 text-left" title="Afficher seulement cette personne">
                              <Avatar name={r.user.name} color={r.user.color} size="md" />
                              <span className="min-w-0">
                                <span className="block truncate font-medium text-gray-900">{r.user.name}</span>
                                <span className="block truncate text-[11px] text-gray-500">
                                  {r.days_worked} j pointé{r.days_worked > 1 ? 's' : ''}
                                  {r.missing_days > 0 && <span className="text-sys-red"> · {r.missing_days} oubli{r.missing_days > 1 ? 's' : ''}</span>}
                                </span>
                              </span>
                            </button>
                          </td>
                          {days.map((d) => {
                            const k = `${r.user.id}|${d}`
                            const date = fromKey(d)
                            const weekend = date.getDay() === 0 || date.getDay() === 6
                            return (
                              <td key={d} className={`border-t border-black/[0.05] p-1 ${weekend ? 'bg-gray-900/[0.02]' : ''}`}>
                                <SheetCell
                                  cell={cells.get(k)}
                                  absence={absenceOn(absences, r.user.id, d)}
                                  past={d < today}
                                  compact={compact}
                                  selected={day?.userId === r.user.id && day.date === d}
                                  flagged={flaggedCells.has(k)}
                                  onClick={() => openDay(r.user.id, d)}
                                />
                              </td>
                            )
                          })}
                          <td className="border-t border-black/[0.05] px-3 py-2 text-right font-semibold tabular-nums text-gray-900">{formatMinutes(r.worked_minutes)}</td>
                          <td className="border-t border-black/[0.05] px-3 py-2 text-right tabular-nums text-gray-500">{formatMinutes(r.planned_minutes)}</td>
                          <td className={`border-t border-black/[0.05] px-3 py-2 text-right tabular-nums ${diff > 0 ? 'text-sys-orange-deep' : diff < 0 ? 'text-gray-500' : 'text-gray-400'}`}>
                            {r.entries === 0 && toDate === 0 ? '—' : signed(diff)}
                          </td>
                          <td className="border-t border-black/[0.05] px-3 py-2 text-right">
                            {pending.length > 0 ? (
                              <Button size="sm" variant="secondary" onClick={() => run('validate', pending)} loading={validate.isPending}>
                                Valider
                              </Button>
                            ) : r.entries > 0 ? (
                              <span className="inline-flex items-center gap-1 text-xs font-medium text-sys-green-deep">
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" aria-hidden>
                                  <path d="m5 12 5 5L20 7" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                                Validé
                              </span>
                            ) : null}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-black/[0.06] px-5 py-2.5 text-[11px] text-gray-500">
              <Legend className="bg-sys-green/18" label="Validé" />
              <Legend className="bg-sys-blue/15" label="À valider" />
              <Legend className="bg-gray-900/[0.07]" label="Brouillon" />
              <Legend className="bg-sys-red/10 ring-1 ring-inset ring-sys-red/40" label="Oubli de pointage" />
              <span className="inline-flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-sys-orange" /> À contrôler
              </span>
            </div>
          </Card>

          {/* Détail d'une journée */}
          {day && (
            <div ref={dayRef} className="scroll-mt-24">
              <DayDetail
                userId={day.userId}
                date={day.date}
                name={nameOf(day.userId)}
                color={people.find((p) => p.id === day.userId)?.color ?? null}
                cell={cells.get(`${day.userId}|${day.date}`)}
                entries={entriesByCell.get(`${day.userId}|${day.date}`) ?? []}
                absence={absenceOn(absences, day.userId, day.date)}
                busy={validate.isPending || reopen.isPending}
                onClose={() => setDay(null)}
                onEdit={(e) => setTarget({ t: { entry: e }, userId: day.userId, name: nameOf(day.userId) })}
                onAdd={(t) => setTarget({ t, userId: day.userId, name: nameOf(day.userId) })}
                onValidate={(ids) => run('validate', ids)}
                onReopen={(ids) => run('reopen', ids)}
              />
            </div>
          )}

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Anomalies */}
            <Card title="À contrôler" description="Oublis, longues journées, chevauchements, écarts avec le planning." flush>
              {anomalies.length === 0 ? (
                <div className="flex items-center gap-3 px-5 py-5">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-sys-green/15 text-sys-green-deep">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" aria-hidden>
                      <path d="m5 12 5 5L20 7" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                  <p className="text-sm text-gray-600">Rien à signaler sur cette période.</p>
                </div>
              ) : (
                <ul className="max-h-80 divide-y divide-black/[0.05] overflow-y-auto">
                  {anomalies.map((a) => (
                    <li key={a.key}>
                      <button type="button" onClick={() => openDay(a.userId, a.date)} className="flex w-full items-center gap-3 px-5 py-2.5 text-left transition hover:bg-white/40">
                        <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${ANOMALY_TONE[a.kind]}`} aria-hidden />
                        <span className="min-w-0 flex-1 truncate text-sm text-gray-800">{a.label}</span>
                        <span className="shrink-0 text-xs capitalize text-gray-500">{formatWeekdayShort(fromKey(a.date))} {fromKey(a.date).getDate()}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            {/* Par chantier */}
            <Card title="Par chantier" description="Heures pointées sur la période." flush>
              {summary.by_chantier.length === 0 ? (
                <p className="px-5 py-4 text-sm text-gray-500">Aucune heure pointée.</p>
              ) : (
                <ul className="divide-y divide-black/[0.05]">
                  {summary.by_chantier.map((row) => {
                    const max = Math.max(1, ...summary.by_chantier.map((x) => x.worked_minutes))
                    return (
                      <li key={row.chantier.id} className="px-5 py-2.5">
                        <div className="flex items-center gap-3">
                          <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: row.chantier.color }} />
                          <span className="min-w-0 flex-1 truncate text-sm text-gray-800">{row.chantier.name}</span>
                          <span className="text-sm font-semibold tabular-nums text-gray-900">{formatMinutes(row.worked_minutes)}</span>
                        </div>
                        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-gray-900/[0.06]">
                          <div className="h-full rounded-full" style={{ width: `${(row.worked_minutes / max) * 100}%`, backgroundColor: row.chantier.color }} />
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </Card>
          </div>

          {/* Liste des pointages */}
          <Card
            title="Pointages"
            description="Clique un horaire pour corriger. Coche pour valider ou rouvrir en lot."
            flush
            action={
              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex rounded-full bg-white/35 p-1 shadow-[inset_0_1px_2px_rgb(15_40_90/0.08)]">
                  {(
                    [
                      ['', 'Tous'],
                      ['submitted', 'À valider'],
                      ['draft', 'Brouillons'],
                      ['validated', 'Validés'],
                    ] as const
                  ).map(([v, l]) => (
                    <button
                      key={v || 'all'}
                      type="button"
                      onClick={() => setParams({ s: v || null })}
                      className={`rounded-full px-3 py-0.5 text-xs font-medium transition ${statusFilter === v ? 'bg-white text-gray-900 shadow-[0_1px_3px_rgb(15_40_90/0.15)]' : 'text-gray-600 hover:text-gray-900'}`}
                    >
                      {l}
                    </button>
                  ))}
                </div>
                {selectedIds.length > 0 && (
                  <>
                    <Button size="sm" variant="secondary" onClick={() => run('reopen', selectedIds)} loading={reopen.isPending}>
                      Rouvrir ({selectedIds.length})
                    </Button>
                    <Button size="sm" onClick={() => run('validate', selectedIds)} loading={validate.isPending}>
                      Valider ({selectedIds.length})
                    </Button>
                  </>
                )}
              </div>
            }
          >
            {visibleEntries.length === 0 ? (
              <EmptyState title="Aucun pointage sur cette période." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-black/[0.06] bg-white/30 text-[12px] font-medium text-gray-500">
                    <tr>
                      <th className="px-4 py-2">
                        <input
                          type="checkbox"
                          aria-label="Tout sélectionner"
                          checked={selectedIds.length === visibleEntries.length && visibleEntries.length > 0}
                          onChange={(e) => setSelected(e.target.checked ? new Set(visibleEntries.map((x) => x.id)) : new Set())}
                          className="h-4 w-4 rounded accent-primary"
                        />
                      </th>
                      <th className="px-4 py-2 text-left font-medium">Jour</th>
                      <th className="px-4 py-2 text-left font-medium">Employé</th>
                      <th className="px-4 py-2 text-left font-medium">Chantier</th>
                      <th className="px-4 py-2 text-left font-medium">Horaire</th>
                      <th className="px-4 py-2 text-right font-medium">Durée</th>
                      <th className="px-4 py-2 text-left font-medium">Statut</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleEntries.map((e) => (
                      <tr key={e.id} className="border-b border-black/[0.05] last:border-0 hover:bg-white/40">
                        <td className="px-4 py-2">
                          <input
                            type="checkbox"
                            aria-label="Sélectionner"
                            checked={selected.has(e.id)}
                            onChange={(ev) =>
                              setSelected((prev) => {
                                const nextSet = new Set(prev)
                                if (ev.target.checked) nextSet.add(e.id)
                                else nextSet.delete(e.id)
                                return nextSet
                              })
                            }
                            className="h-4 w-4 rounded accent-primary"
                          />
                        </td>
                        <td className="whitespace-nowrap px-4 py-2 text-gray-700">{formatDate(e.date)}</td>
                        <td className="px-4 py-2">
                          <span className="flex items-center gap-2">
                            {e.user && <Avatar name={e.user.name} color={e.user.color} size="xs" />}
                            <span className="text-gray-900">{e.user?.name ?? nameOf(e.user_id)}</span>
                          </span>
                        </td>
                        <td className="px-4 py-2 text-gray-700">
                          {e.chantier?.name ?? <span className="italic text-gray-400">Sans chantier</span>}
                          {e.comment && (
                            <span className="block max-w-xs truncate text-xs italic text-gray-500" title={e.comment}>
                              {e.comment}
                            </span>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-4 py-2">
                          <button type="button" onClick={() => setTarget({ t: { entry: e }, userId: e.user_id, name: e.user?.name ?? nameOf(e.user_id) })} className="text-gray-800 hover:text-primary hover:underline">
                            {e.start_time} – {e.end_time}
                            {e.break_minutes > 0 && <span className="text-xs text-gray-500"> · pause {e.break_minutes}</span>}
                          </button>
                        </td>
                        <td className="px-4 py-2 text-right font-medium tabular-nums">{formatMinutes(e.minutes)}</td>
                        <td className="px-4 py-2">
                          <Badge tone={statusTone(e.status)}>{e.status_label}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}

      <TimeEntryModal target={target?.t ?? null} onClose={() => setTarget(null)} chantiers={chantiers} userId={target?.userId || undefined} personName={target?.name} />
    </div>
  )
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`h-3 w-5 rounded-md ${className}`} /> {label}
    </span>
  )
}

/** Détail d'une journée d'un employé : prévu vs pointé, correction, validation, pointage à sa place. */
function DayDetail({
  userId,
  date,
  name,
  color,
  cell,
  entries,
  absence,
  busy,
  onClose,
  onEdit,
  onAdd,
  onValidate,
  onReopen,
}: {
  userId: number
  date: string
  name: string
  color: string | null
  cell?: HoursCell
  entries: TimeEntry[]
  absence?: Absence
  busy: boolean
  onClose: () => void
  onEdit: (e: TimeEntry) => void
  onAdd: (t: TimeEntryTarget) => void
  onValidate: (ids: number[]) => void
  onReopen: (ids: number[]) => void
}) {
  const { data: planned = [], isLoading } = usePlanning({ from: date, to: date, worker_id: userId })
  const mine = planned.filter((a) => a.workers.some((w) => w.id === userId))
  const sorted = [...entries].sort((a, b) => a.start_time.localeCompare(b.start_time))
  const worked = sorted.reduce((s, e) => s + e.minutes, 0)
  const plannedMinutes = cell?.planned_minutes ?? 0
  const pending = sorted.filter((e) => e.status !== 'validated').map((e) => e.id)
  const validated = sorted.filter((e) => e.status === 'validated').map((e) => e.id)

  return (
    <Card
      title={
        <span className="flex items-center gap-2.5">
          <Avatar name={name} color={color} size="md" />
          <span>
            <span className="block">{name}</span>
            <span className="block text-[13px] font-normal capitalize text-gray-500">{formatLongDay(fromKey(date))}</span>
          </span>
        </span>
      }
      action={
        <button type="button" onClick={onClose} aria-label="Fermer" className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-900/[0.06] text-gray-600 hover:bg-gray-900/[0.1]">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6">
            <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" />
          </svg>
        </button>
      }
    >
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Prévu */}
        <div>
          <p className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-gray-500">Prévu au planning · {formatMinutes(plannedMinutes)}</p>
          {absence && <p className="mb-2 rounded-xl bg-gray-900/[0.05] px-3 py-2 text-sm text-gray-600">Absent : {absence.type_label}</p>}
          {isLoading ? (
            <Spinner />
          ) : mine.length === 0 ? (
            <p className="text-sm text-gray-500">Rien de planifié ce jour-là.</p>
          ) : (
            <ul className="space-y-2">
              {mine.map((a) => {
                const done = sorted.some((e) => e.affectation_id === a.id)
                return (
                  <li key={a.id} className="flex items-center gap-3 rounded-2xl bg-white/45 px-3 py-2.5">
                    <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: a.chantier.color }} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-gray-900">{a.chantier.name}</span>
                      <span className="block text-xs tabular-nums text-gray-500">{formatTimeRange(a.start_time, a.end_time)}</span>
                    </span>
                    {done ? (
                      <Badge tone="success">Pointé</Badge>
                    ) : (
                      <Button size="sm" variant="secondary" onClick={() => onAdd({ affectation: a })}>
                        Pointer selon le planning
                      </Button>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        {/* Pointé */}
        <div>
          <p className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-gray-500">
            Pointé · {formatMinutes(worked)}
            {plannedMinutes > 0 && worked > 0 && worked !== plannedMinutes && <span className={worked > plannedMinutes ? 'text-sys-orange-deep' : 'text-gray-500'}> ({signed(worked - plannedMinutes)})</span>}
          </p>
          {sorted.length === 0 ? (
            <p className="text-sm text-gray-500">Aucune heure pointée.</p>
          ) : (
            <ul className="space-y-2">
              {sorted.map((e) => (
                <li key={e.id} className="flex items-center gap-3 rounded-2xl bg-white/45 px-3 py-2.5">
                  <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: e.chantier?.color ?? '#aeaeb2' }} />
                  <button type="button" onClick={() => onEdit(e)} className="min-w-0 flex-1 text-left" title="Corriger">
                    <span className="block truncate text-sm font-medium text-gray-900 hover:text-primary">{e.chantier?.name ?? 'Sans chantier'}</span>
                    <span className="block text-xs tabular-nums text-gray-500">
                      {e.start_time} – {e.end_time}
                      {e.break_minutes > 0 ? ` · pause ${e.break_minutes} min` : ''} · <span className="font-semibold text-gray-700">{formatMinutes(e.minutes)}</span>
                    </span>
                    {e.comment && <span className="block truncate text-xs italic text-gray-500">{e.comment}</span>}
                  </button>
                  <Badge tone={statusTone(e.status)}>{e.status_label}</Badge>
                  <button
                    type="button"
                    onClick={() => onEdit(e)}
                    aria-label="Corriger"
                    title="Corriger"
                    className="glass-pill flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-gray-700"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3Z" strokeLinejoin="round" />
                      <path d="m13.5 6.5 3 3" />
                    </svg>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-black/[0.06] pt-4">
        <Button variant="secondary" size="sm" onClick={() => onAdd({ date })}>
          + Ajouter des heures
        </Button>
        <div className="flex-1" />
        {validated.length > 0 && (
          <Button variant="ghost" size="sm" onClick={() => onReopen(validated)} disabled={busy}>
            Rouvrir
          </Button>
        )}
        {pending.length > 0 && (
          <Button size="sm" onClick={() => onValidate(pending)} loading={busy}>
            Valider la journée
          </Button>
        )}
      </div>
    </Card>
  )
}
