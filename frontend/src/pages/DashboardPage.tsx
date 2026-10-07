import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/auth/AuthContext'
import { useOpenChantiers } from '@/hooks/useChantiers'
import { useDashboard } from '@/hooks/useDashboard'
import { useReadSignalement } from '@/hooks/useSignalements'
import { formatLongDay, formatTimeRange, formatWeekdayShort, fromKey, todayKey } from '@/lib/dates'
import { formatDate, formatMinutes, formatRelative } from '@/lib/format'
import { toast } from '@/lib/toast'
import { getErrorMessage } from '@/lib/errors'
import type { Affectation, Worker } from '@/types'
import Avatar from '@/components/ui/Avatar'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import EmptyState from '@/components/ui/EmptyState'
import PageHeader from '@/components/ui/PageHeader'
import Spinner from '@/components/ui/Spinner'
import QuickChantierModal from '@/components/planning/QuickChantierModal'

/* Icônes des tuiles (traits fins, façon SF Symbols). */
const ICONS = {
  plus: <path d="M12 5v14M5 12h14" strokeLinecap="round" />,
  people: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M21.5 20a6.5 6.5 0 0 0-5-6.3" strokeLinecap="round" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  bell: <path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15L6 16ZM10 20a2 2 0 0 0 4 0" strokeLinecap="round" strokeLinejoin="round" />,
  calendar: (
    <>
      <rect x="3.5" y="5" width="17" height="15" rx="3" />
      <path d="M3.5 10h17M8 3v4M16 3v4" strokeLinecap="round" />
    </>
  ),
  pin: (
    <>
      <path d="M12 21s-6.5-6-6.5-11a6.5 6.5 0 0 1 13 0c0 5-6.5 11-6.5 11Z" strokeLinejoin="round" />
      <circle cx="12" cy="10" r="2.2" />
    </>
  ),
}

interface TileProps {
  icon: keyof typeof ICONS
  label: string
  value: ReactNode
  hint?: ReactNode
  color: string
  to?: string
  onClick?: () => void
  /** Met en avant (tuile pleine couleur). */
  solid?: boolean
}

/** Tuile d'action rapide (façon Centre de contrôle) : icône, grand chiffre, libellé. */
function Tile({ icon, label, value, hint, color, to, onClick, solid = false }: TileProps) {
  const className = `group flex min-h-32 flex-col justify-between rounded-card p-4 text-left transition active:scale-[0.98] ${
    solid ? 'gloss text-white' : 'glass-panel hover:bg-white/80'
  }`
  const style = solid ? { background: `linear-gradient(145deg, ${color}, color-mix(in oklab, ${color} 75%, black))` } : undefined
  const body = (
    <>
      <span
        className={`flex h-10 w-10 items-center justify-center rounded-full ${solid ? 'bg-white/20' : ''}`}
        style={solid ? undefined : { backgroundColor: `color-mix(in oklab, ${color} 16%, white)`, color }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
          {ICONS[icon]}
        </svg>
      </span>
      <span>
        <span className={`block text-[26px] font-bold leading-none tracking-tight tabular-nums ${solid ? '' : 'text-gray-900'}`}>{value}</span>
        <span className={`mt-1 block text-[13px] font-medium ${solid ? 'text-white/90' : 'text-gray-700'}`}>{label}</span>
        {hint && <span className={`block text-[11px] ${solid ? 'text-white/70' : 'text-gray-500'}`}>{hint}</span>}
      </span>
    </>
  )
  if (to) {
    return (
      <Link to={to} className={className} style={style}>
        {body}
      </Link>
    )
  }
  return (
    <button type="button" onClick={onClick} className={className} style={style}>
      {body}
    </button>
  )
}

interface TodaySite {
  chantier: Affectation['chantier']
  slots: Affectation[]
  people: Worker[]
  visitors: Worker[]
}

/** Regroupe les affectations du jour par chantier (une ligne par chantier, créneaux et personnes réunis). */
function groupByChantier(affectations: Affectation[]): TodaySite[] {
  const map = new Map<number, TodaySite>()
  for (const a of affectations) {
    const site = map.get(a.chantier.id) ?? { chantier: a.chantier, slots: [], people: [], visitors: [] }
    site.slots.push(a)
    for (const w of a.workers) if (!site.people.some((p) => p.id === w.id)) site.people.push(w)
    for (const v of a.visitors ?? []) if (!site.visitors.some((p) => p.id === v.id) && !site.people.some((p) => p.id === v.id)) site.visitors.push(v)
    map.set(a.chantier.id, site)
  }
  return [...map.values()]
}

/**
 * Tableau de bord des planificateurs : actions rapides (nouveau chantier, journée,
 * heures à valider, imprévus, absences), chantiers du jour avec accès direct à la
 * fiche et au planning, semaine en un coup d'œil, puis le suivi (imprévus,
 * disponibles, heures par chantier, absences).
 */
export default function DashboardPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { data, isLoading } = useDashboard()
  const { data: chantiers = [] } = useOpenChantiers()
  const readSignalement = useReadSignalement()
  const [quickOpen, setQuickOpen] = useState(false)

  const planning = data?.planning
  const week = data?.week
  const today = todayKey()
  const todaySites = useMemo(() => groupByChantier(planning?.today_affectations ?? []), [planning])
  const maxPerDay = Math.max(1, ...(week?.days.map((d) => d.affectations) ?? [1]))

  return (
    <>
      <PageHeader
        title={`Bonjour ${user?.name.split(' ')[0] ?? ''}`}
        subtitle={planning ? formatLongDay(fromKey(planning.today)) : "Voici un aperçu de l'application."}
        action={
          planning && (
            <>
              <Button variant="secondary" onClick={() => navigate('/planning')}>
                Ouvrir le planning
              </Button>
              <Button onClick={() => setQuickOpen(true)}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                  <path d="M12 5v14M5 12h14" strokeLinecap="round" />
                </svg>
                Nouveau chantier
              </Button>
            </>
          )
        }
      />

      {isLoading ? (
        <Spinner block />
      ) : !planning || !week ? (
        <EmptyState title="Rien à afficher ici." description="Ton planning personnel est dans « Mon planning »." action={<Link to="/mon-planning"><Button>Mon planning</Button></Link>} />
      ) : (
        <div className="space-y-6">
          {/* Actions rapides */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <Tile icon="plus" label="Nouveau chantier" value="Créer" hint="Nom, client, adresse" color="var(--color-primary)" solid onClick={() => setQuickOpen(true)} />
            <Tile
              icon="people"
              label="Sur le terrain"
              value={`${planning.workers_assigned_today} / ${planning.workers_total}`}
              hint={planning.workers_absent_today ? `${planning.workers_absent_today} absent(s)` : `${todaySites.length} chantier${todaySites.length > 1 ? 's' : ''} aujourd'hui`}
              color="#30b0c7"
              to="/planning?view=day"
            />
            <Tile
              icon="clock"
              label="Heures à valider"
              value={week.entries_to_validate}
              hint={`${formatMinutes(week.worked_minutes)} pointées cette semaine`}
              color="#34c759"
              to="/statistiques/heures"
            />
            <Tile icon="bell" label="Imprévus" value={week.unread_signalements} hint={week.unread_signalements ? 'à traiter' : 'rien à signaler'} color="#ff9500" to="#imprevus" />
            <Tile icon="calendar" label="Absences" value={week.absences.length} hint="cette semaine" color="#af52de" to="/absences" />
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            {/* Chantiers du jour */}
            <Card
              title="Chantiers du jour"
              description="Qui est où ; un clic pour la fiche ou le planning."
              className="lg:col-span-2"
              flush
              action={
                <Link to="/planning?view=day" className="text-sm font-medium text-primary hover:underline">
                  Voir la journée
                </Link>
              }
            >
              {todaySites.length === 0 ? (
                <EmptyState
                  title="Aucun chantier planifié aujourd'hui."
                  description="Glisse une équipe sur le calendrier, ou crée un chantier."
                  action={
                    <div className="flex gap-2">
                      <Button variant="secondary" onClick={() => navigate('/planning')}>
                        Ouvrir le planning
                      </Button>
                      <Button onClick={() => setQuickOpen(true)}>Nouveau chantier</Button>
                    </div>
                  }
                />
              ) : (
                <ul className="divide-y divide-black/[0.05]">
                  {todaySites.map((site) => (
                    <li key={site.chantier.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3.5 transition hover:bg-white/40">
                      <span
                        className="h-4 w-4 shrink-0 rounded-full shadow-[inset_0_1px_0_rgb(255_255_255/0.5),0_1px_2px_rgb(0_0_0/0.15)]"
                        style={{ backgroundColor: site.chantier.color }}
                        aria-hidden
                      />
                      <div className="min-w-0 flex-1 basis-40">
                        <Link to={`/chantiers/${site.chantier.id}`} className="block truncate text-[15px] font-semibold text-gray-900 hover:text-primary">
                          {site.chantier.name}
                        </Link>
                        <p className="truncate text-xs text-gray-500">
                          {[site.chantier.address, site.chantier.city].filter(Boolean).join(', ') || 'Adresse non renseignée'}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {site.slots.map((s) => (
                          <span key={s.id} className="rounded-full bg-gray-900/[0.05] px-2 py-0.5 text-xs font-medium tabular-nums text-gray-800">
                            {formatTimeRange(s.start_time, s.end_time)}
                          </span>
                        ))}
                      </div>
                      <div className="flex items-center -space-x-1.5">
                        {site.people.map((p) => (
                          <Avatar key={p.id} name={p.name} color={p.color} size="sm" />
                        ))}
                        {site.visitors.map((p) => (
                          <Avatar key={p.id} name={p.name} color={p.color} size="sm" className="opacity-70" title={`${p.name} (passage)`} />
                        ))}
                        {site.people.length === 0 && site.visitors.length === 0 && <Badge tone="danger">Sans équipe</Badge>}
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <Link to={`/chantiers/${site.chantier.id}`} className="glass-pill rounded-full px-3 py-1 text-xs font-medium text-gray-800">
                          Fiche
                        </Link>
                        <Link to={`/planning?view=day&d=${today}&chantier=${site.chantier.id}`} className="glass-pill rounded-full px-3 py-1 text-xs font-medium text-gray-800">
                          Planning
                        </Link>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            {/* Disponibles */}
            <Card title="Disponibles aujourd'hui" description="Personnes sans affectation.">
              {planning.workers_free_today.length === 0 ? (
                <p className="text-sm text-gray-500">Toute l'équipe est affectée.</p>
              ) : (
                <ul className="space-y-2.5">
                  {planning.workers_free_today.map((w) => (
                    <li key={w.id} className="flex items-center gap-2.5">
                      <Avatar name={w.name} color={w.color} size="md" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-gray-900">{w.name}</p>
                        <p className="truncate text-xs text-gray-500">{w.job_title ?? '—'}</p>
                      </div>
                      <Link to={`/planning?view=day&d=${today}`} className="text-xs font-medium text-primary hover:underline">
                        Affecter
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          {/* Semaine en un coup d'œil */}
          <Card title="La semaine en un coup d'œil" description="Affectations par jour, équipes manquantes, personnes libres et absentes." flush>
            <div className="grid grid-cols-5 divide-x divide-black/[0.05] lg:grid-cols-7">
              {week.days.map((d, i) => {
                const isToday = d.date === today
                const weekend = i >= 5
                const level = d.affectations / maxPerDay
                return (
                  <Link
                    key={d.date}
                    to={`/planning?view=day&d=${d.date}`}
                    className={`${weekend ? 'hidden lg:block' : ''} p-3 transition hover:bg-white/50 ${isToday ? 'bg-primary/10' : ''}`}
                  >
                    <p className={`text-xs font-semibold ${isToday ? 'text-primary' : 'text-gray-500'}`}>
                      {formatWeekdayShort(fromKey(d.date))} <span className="font-normal">{fromKey(d.date).getDate()}</span>
                    </p>
                    <div className="mt-2 flex items-end gap-2">
                      <span className="text-[26px] font-bold leading-none tabular-nums text-gray-900">{d.affectations}</span>
                      <span className="mb-0.5 text-[11px] text-gray-500">affect.</span>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-gray-900/[0.06]">
                      <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${Math.round(level * 100)}%`, opacity: d.affectations ? 0.9 : 0 }} />
                    </div>
                    {d.unstaffed > 0 && <p className="mt-1.5 text-[11px] font-medium text-sys-red">{d.unstaffed} sans équipe</p>}
                    {d.free.length > 0 && !weekend && (
                      <p className="mt-1 truncate text-[11px] text-gray-500" title={d.free.map((p) => p.name).join(', ')}>
                        Libres : {d.free.map((p) => p.name.split(' ')[0]).join(', ')}
                      </p>
                    )}
                    {d.absent.length > 0 && (
                      <p className="mt-0.5 truncate text-[11px] text-sys-orange-deep" title={d.absent.map((p) => p.name).join(', ')}>
                        Absents : {d.absent.map((p) => p.name.split(' ')[0]).join(', ')}
                      </p>
                    )}
                  </Link>
                )
              })}
            </div>
          </Card>

          <div className="grid gap-6 lg:grid-cols-3">
            <Card title="Imprévus à traiter" description="Signalés depuis les chantiers." flush className="scroll-mt-24" id="imprevus">
              {week.latest_signalements.length === 0 ? (
                <p className="px-5 py-4 text-sm text-gray-500">Rien à traiter.</p>
              ) : (
                <ul className="divide-y divide-black/[0.05]">
                  {week.latest_signalements.map((s) => (
                    <li key={s.id} className="flex items-start gap-3 px-5 py-3">
                      {s.user && <Avatar name={s.user.name} color={s.user.color} size="sm" />}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-gray-900">
                          <span className="font-medium">{s.user?.name.split(' ')[0]}</span> · <Badge tone="warn">{s.type_label}</Badge>
                        </p>
                        <p className="mt-0.5 text-sm text-gray-700">{s.message}</p>
                        <p className="text-xs text-gray-500">
                          {s.affectation?.chantier ? `${s.affectation.chantier} · ` : ''}
                          {s.date ? formatDate(s.date) : formatRelative(s.created_at)}
                        </p>
                      </div>
                      <Button size="sm" variant="ghost" onClick={() => readSignalement.mutate(s.id, { onError: (err) => toast(getErrorMessage(err), 'error') })}>
                        Traité
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card title="Heures par chantier" description="Pointé cette semaine, comparé au planifié." flush action={<Link to="/statistiques/heures" className="text-sm font-medium text-primary hover:underline">Heures</Link>}>
              {week.hours_by_chantier.length === 0 ? (
                <p className="px-5 py-4 text-sm text-gray-500">Aucune heure pointée cette semaine.</p>
              ) : (
                <ul className="divide-y divide-black/[0.05]">
                  {week.hours_by_chantier.map((row) => {
                    const pct = row.planned_minutes ? Math.min(100, Math.round((row.worked_minutes / row.planned_minutes) * 100)) : 0
                    return (
                      <li key={row.chantier.id} className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: row.chantier.color }} />
                          <span className="min-w-0 flex-1 truncate text-sm text-gray-800">{row.chantier.name}</span>
                          <span className="text-sm font-semibold tabular-nums text-gray-900">{formatMinutes(row.worked_minutes)}</span>
                          {row.planned_minutes > 0 && <span className="text-xs text-gray-500">/ {formatMinutes(row.planned_minutes)}</span>}
                        </div>
                        {row.planned_minutes > 0 && (
                          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-gray-900/[0.06]">
                            <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: row.chantier.color }} />
                          </div>
                        )}
                      </li>
                    )
                  })}
                </ul>
              )}
            </Card>

            <Card title="Absences de la semaine" flush action={<Link to="/absences" className="text-sm font-medium text-primary hover:underline">Gérer</Link>}>
              {week.absences.length === 0 ? (
                <p className="px-5 py-4 text-sm text-gray-500">Personne d'absent cette semaine.</p>
              ) : (
                <ul className="divide-y divide-black/[0.05]">
                  {week.absences.map((ab) => (
                    <li key={ab.id} className="flex items-center gap-3 px-5 py-2.5">
                      <Avatar name={ab.user.name} color={ab.user.color} size="sm" />
                      <span className="min-w-0 flex-1 truncate text-sm text-gray-800">{ab.user.name}</span>
                      <span className="text-xs text-gray-500">
                        {ab.start_date === ab.end_date ? formatDate(ab.start_date) : `${formatDate(ab.start_date)} → ${formatDate(ab.end_date)}`}
                      </span>
                      <Badge tone="info">{ab.type_label}</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </div>
      )}

      <QuickChantierModal open={quickOpen} onClose={() => setQuickOpen(false)} existing={chantiers} onCreated={(c) => navigate(`/chantiers/${c.id}`)} />
    </>
  )
}
