// Helpers de formatage pour l'affichage (dates, nombres, montants, tailles).
// Locale et devise par défaut : Suisse romande. Change-les ici pour tout le projet.

export const LOCALE = 'fr-CH'
export const CURRENCY = 'CHF'

const dateFmt = new Intl.DateTimeFormat(LOCALE, { day: '2-digit', month: '2-digit', year: 'numeric' })
const dateTimeFmt = new Intl.DateTimeFormat(LOCALE, {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})
const numberFmt = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 2 })
const currencyFmts = new Map<string, Intl.NumberFormat>()

function toDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null
  const d = value instanceof Date ? value : new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

/** "2026-09-14" ou ISO → "14.09.2026". */
export function formatDate(value: string | Date | null | undefined): string {
  const d = toDate(value)
  return d ? dateFmt.format(d) : '—'
}

/** ISO → "14.09.2026 10:30". */
export function formatDateTime(value: string | Date | null | undefined): string {
  const d = toDate(value)
  return d ? dateTimeFmt.format(d) : '—'
}

/** Délai relatif court ("il y a 5 min", "hier", ou la date si plus ancien). */
export function formatRelative(value: string | Date | null | undefined): string {
  const d = toDate(value)
  if (!d) return '—'
  const diff = (Date.now() - d.getTime()) / 1000
  if (diff < 60) return "à l'instant"
  if (diff < 3600) return `il y a ${Math.floor(diff / 60)} min`
  if (diff < 86400) return `il y a ${Math.floor(diff / 3600)} h`
  if (diff < 172800) return 'hier'
  return formatDate(d)
}

/** Nombre avec séparateurs locaux ("1 234.5"). */
export function formatNumber(value: number | string | null | undefined): string {
  const n = typeof value === 'string' ? parseFloat(value) : value
  return n === null || n === undefined || Number.isNaN(n) ? '—' : numberFmt.format(n)
}

/** Montant dans une devise (CHF par défaut). */
export function formatMoney(value: number | string | null | undefined, currency = CURRENCY): string {
  const n = typeof value === 'string' ? parseFloat(value) : (value ?? 0)
  let fmt = currencyFmts.get(currency)
  if (!fmt) {
    fmt = new Intl.NumberFormat(LOCALE, { style: 'currency', currency })
    currencyFmts.set(currency, fmt)
  }
  return fmt.format(Number.isFinite(n) ? n : 0)
}

/** Taille de fichier lisible ("1.2 Mo"). */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`
  const units = ['Ko', 'Mo', 'Go']
  let value = bytes / 1024
  let i = 0
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024
    i++
  }
  return `${value.toFixed(value < 10 ? 1 : 0)} ${units[i]}`
}

/** Initiales d'un nom ("Jérôme Dupont" → "JD"). */
export function initials(name: string | null | undefined): string {
  if (!name) return '?'
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')
}

/** Minutes → « 7h30 » (ou « 45 min » sous l'heure, « 0h » si rien). */
export function formatMinutes(minutes: number | null | undefined): string {
  const m = Math.max(0, Math.round(minutes ?? 0))
  if (m === 0) return '0h'
  if (m < 60) return `${m} min`
  const h = Math.floor(m / 60)
  const r = m % 60
  return r === 0 ? `${h}h` : `${h}h${String(r).padStart(2, '0')}`
}
