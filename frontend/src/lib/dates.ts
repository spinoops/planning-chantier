// Utilitaires de dates du calendrier. Tout est calculé en heure locale et les
// jours circulent sous forme de clés « YYYY-MM-DD » (format de l'API).

import { LOCALE } from '@/lib/format'

export type DateKey = string

/** Date → « YYYY-MM-DD » (heure locale, sans décalage UTC). */
export function toKey(d: Date): DateKey {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** « YYYY-MM-DD » → Date locale à minuit. */
export function fromKey(key: DateKey): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function todayKey(): DateKey {
  return toKey(new Date())
}

export function addDays(d: Date, n: number): Date {
  const copy = new Date(d)
  copy.setDate(copy.getDate() + n)
  return copy
}

export function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1)
}

/** Lundi de la semaine contenant `d`. */
export function startOfWeek(d: Date): Date {
  const copy = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const day = (copy.getDay() + 6) % 7 // lundi = 0
  return addDays(copy, -day)
}

export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

/** Les 7 jours de la semaine (lundi → dimanche) contenant `d`. */
export function weekDays(d: Date): Date[] {
  const monday = startOfWeek(d)
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i))
}

/** Grille du mois : semaines complètes (lundi → dimanche) couvrant le mois de `d`. */
export function monthGrid(d: Date): Date[][] {
  const first = startOfMonth(d)
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0)
  let cursor = startOfWeek(first)
  const weeks: Date[][] = []
  while (cursor <= last || weeks.length < 4) {
    weeks.push(Array.from({ length: 7 }, (_, i) => addDays(cursor, i)))
    cursor = addDays(cursor, 7)
  }
  return weeks
}

export function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

export function isWeekend(d: Date): boolean {
  const day = d.getDay()
  return day === 0 || day === 6
}

/** Numéro de semaine ISO 8601. */
export function isoWeek(d: Date): number {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const dayNum = date.getUTCDay() || 7
  date.setUTCDate(date.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1))
  return Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
}

const monthYearFmt = new Intl.DateTimeFormat(LOCALE, { month: 'long', year: 'numeric' })
const dayMonthFmt = new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'short' })
const longDayFmt = new Intl.DateTimeFormat(LOCALE, { weekday: 'long', day: 'numeric', month: 'long' })
const weekdayShortFmt = new Intl.DateTimeFormat(LOCALE, { weekday: 'short' })
const weekdayLongFmt = new Intl.DateTimeFormat(LOCALE, { weekday: 'long' })

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/** « septembre 2026 » → « Septembre 2026 ». */
export function formatMonthYear(d: Date): string {
  return capitalize(monthYearFmt.format(d))
}

/** « 23 sept. » */
export function formatDayMonth(d: Date): string {
  return dayMonthFmt.format(d)
}

/** « Mercredi 23 septembre » */
export function formatLongDay(d: Date): string {
  return capitalize(longDayFmt.format(d))
}

/** « mer. » → « Mer » */
export function formatWeekdayShort(d: Date): string {
  return capitalize(weekdayShortFmt.format(d).replace('.', ''))
}

export function formatWeekdayLong(d: Date): string {
  return capitalize(weekdayLongFmt.format(d))
}

/** « 21 – 27 sept. 2026 » ou « 28 sept. – 4 oct. 2026 ». */
export function formatWeekRange(d: Date): string {
  const days = weekDays(d)
  const first = days[0]
  const last = days[6]
  const sameMonth = first.getMonth() === last.getMonth()
  const left = sameMonth ? String(first.getDate()) : dayMonthFmt.format(first)
  return `${left} – ${dayMonthFmt.format(last)} ${last.getFullYear()}`
}

/** Libellé relatif : « Aujourd'hui », « Demain », sinon le jour complet. */
export function formatRelativeDay(d: Date): string {
  const today = new Date()
  if (isSameDay(d, today)) return "Aujourd'hui"
  if (isSameDay(d, addDays(today, 1))) return 'Demain'
  if (isSameDay(d, addDays(today, -1))) return 'Hier'
  return formatLongDay(d)
}

/** « 07:00 – 16:30 », « dès 07:00 », « jusqu'à 12:00 » ou « Journée ». */
export function formatTimeRange(start: string | null, end: string | null): string {
  if (start && end) return `${start} – ${end}`
  if (start) return `dès ${start}`
  if (end) return `jusqu'à ${end}`
  return 'Journée'
}
