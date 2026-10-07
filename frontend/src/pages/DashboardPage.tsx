import { Link } from 'react-router-dom'
import { useAuth } from '@/auth/AuthContext'
import { useDashboard } from '@/hooks/useDashboard'
import { useReadSignalement } from '@/hooks/useSignalements'
import { describeActivity } from '@/lib/activity'
import { formatLongDay, formatWeekdayShort, fromKey, todayKey } from '@/lib/dates'
import { formatDate, formatMinutes, formatRelative } from '@/lib/format'
import { toast } from '@/lib/toast'
import { getErrorMessage } from '@/lib/errors'
import Avatar from '@/components/ui/Avatar'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import EmptyState from '@/components/ui/EmptyState'
import PageHeader from '@/components/ui/PageHeader'
import Spinner from '@/components/ui/Spinner'
import StatCard from '@/components/ui/StatCard'
import AffectationCard from '@/components/planning/AffectationCard'

/**
 * Tableau de bord des planificateurs : l'état du jour, puis le pilotage de la
 * semaine (qui est où, chantiers sans équipe, personnes libres, heures pointées
 * par chantier, imprévus à traiter, heures à valider, absences).
 */
export default function DashboardPage() {
  const { user } = useAuth()
  const { data, isLoading } = useDashboard()
  const readSignalement = useReadSignalement()

  const maxSignups = Math.max(1, ...(data?.signups?.map((s) => s.count) ?? [0]))
  const planning = data?.planning
  const week = data?.week
  const today = todayKey()

  return (
    <>
      <PageHeader
        title={`Bonjour ${user?.name.split(' ')[0] ?? ''}`}
        subtitle={planning ? formatLongDay(fromKey(planning.today)) : "Voici un aperçu de l'application."}
        action={
          planning && (
            <Link to="/planning" className="hidden items-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 sm:inline-flex">
              Ouvrir le planning
            </Link>
          )
        }
      />

      {isLoading ? (
        <Spinner block />
      ) : (
        <div className="space-y-6">
          {planning && week && (
            <>
              {/* Indicateurs du jour et de la semaine */}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard label="Sur le terrain aujourd'hui" value={`${planning.workers_assigned_today} / ${planning.workers_total}`} hint={planning.workers_absent_today ? `${planning.workers_absent_today} absent(s)` : 'personnes affectées'} tone="primary" />
                <StatCard
                  label="À traiter"
                  value={week.unread_signalements + week.entries_to_validate}
                  hint={`${week.unread_signalements} imprévu(s) · ${week.entries_to_validate} pointage(s) à valider`}
                  tone={week.unread_signalements + week.entries_to_validate > 0 ? 'warn' : 'default'}
                />
                <StatCard
                  label="Heures pointées (semaine)"
                  value={formatMinutes(week.worked_minutes)}
                  hint={week.planned_minutes ? `sur ${formatMinutes(week.planned_minutes)} planifiées` : 'aucune planification'}
                />
                <StatCard label="Chantiers en cours" value={planning.chantiers_active} hint={<Link to="/chantiers" className="text-primary hover:underline">{planning.chantiers_planned} à venir</Link>} />
              </div>

              {/* Semaine en un coup d'œil */}
              <Card title="La semaine en un coup d'œil" description="Chantiers par jour, équipes manquantes, personnes libres et absentes." flush>
                <div className="grid grid-cols-5 divide-x divide-gray-100 lg:grid-cols-7">
                  {week.days.map((d, i) => {
                    const isToday = d.date === today
                    const weekend = i >= 5
                    return (
                      <Link
                        key={d.date}
                        to={`/planning?view=day&d=${d.date}`}
                        className={`${weekend ? 'hidden lg:block' : ''} p-3 transition hover:bg-gray-50 ${isToday ? 'bg-primary-soft' : ''}`}
                      >
                        <p className={`text-xs font-semibold uppercase ${isToday ? 'text-primary' : 'text-gray-500'}`}>
                          {formatWeekdayShort(fromKey(d.date))} <span className="font-normal">{fromKey(d.date).getDate()}</span>
                        </p>
                        <p className="mt-1 text-2xl font-semibold tabular-nums text-gray-900">{d.affectations}</p>
                        <p className="text-[11px] text-gray-500">chantier{d.affectations > 1 ? 's' : ''}</p>
                        {d.unstaffed > 0 && <p className="mt-1 text-[11px] font-medium text-red-600">{d.unstaffed} sans équipe</p>}
                        {d.free.length > 0 && !weekend && (
                          <p className="mt-1 truncate text-[11px] text-gray-500" title={d.free.map((p) => p.name).join(', ')}>
                            Libres : {d.free.map((p) => p.name.split(' ')[0]).join(', ')}
                          </p>
                        )}
                        {d.absent.length > 0 && (
                          <p className="mt-0.5 truncate text-[11px] text-amber-700" title={d.absent.map((p) => p.name).join(', ')}>
                            Absents : {d.absent.map((p) => p.name.split(' ')[0]).join(', ')}
                          </p>
                        )}
                      </Link>
                    )
                  })}
                </div>
              </Card>

              <div className="grid gap-6 lg:grid-cols-3">
                <Card
                  title="Aujourd'hui sur les chantiers"
                  description="Qui est où, et à quelle heure."
                  className="lg:col-span-2"
                  action={
                    <Link to="/planning?view=day" className="text-sm font-medium text-primary hover:underline">
                      Voir la journée
                    </Link>
                  }
                >
                  {planning.today_affectations.length === 0 ? (
                    <EmptyState
                      title="Aucune affectation aujourd'hui."
                      description="Planifie la journée depuis le calendrier."
                      action={
                        <Link to="/planning">
                          <Button>Ouvrir le planning</Button>
                        </Link>
                      }
                    />
                  ) : (
                    <div className="grid gap-3 sm:grid-cols-2">
                      {planning.today_affectations.map((a) => (
                        <AffectationCard key={a.id} affectation={a} variant="detail" />
                      ))}
                    </div>
                  )}
                </Card>

                <div className="space-y-6">
                  <Card title="Imprévus à traiter" description="Signalés depuis les chantiers." flush action={<Link to="/heures" className="text-sm font-medium text-primary hover:underline">Heures</Link>}>
                    {week.latest_signalements.length === 0 ? (
                      <p className="px-5 py-4 text-sm text-gray-500">Rien à traiter.</p>
                    ) : (
                      <ul className="divide-y divide-gray-100">
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
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => readSignalement.mutate(s.id, { onError: (err) => toast(getErrorMessage(err), 'error') })}
                            >
                              Traité
                            </Button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </Card>

                  <Card title="Disponibles aujourd'hui" description="Personnes sans affectation.">
                    {planning.workers_free_today.length === 0 ? (
                      <p className="text-sm text-gray-500">Toute l'équipe est affectée.</p>
                    ) : (
                      <ul className="space-y-2">
                        {planning.workers_free_today.map((w) => (
                          <li key={w.id} className="flex items-center gap-2.5">
                            <Avatar name={w.name} color={w.color} size="md" />
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-gray-900">{w.name}</p>
                              <p className="truncate text-xs text-gray-500">{w.job_title ?? '—'}</p>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </Card>
                </div>
              </div>

              <div className="grid gap-6 lg:grid-cols-2">
                <Card title="Heures par chantier" description="Pointé cette semaine, comparé au planifié." flush>
                  {week.hours_by_chantier.length === 0 ? (
                    <p className="px-5 py-4 text-sm text-gray-500">Aucune heure pointée cette semaine.</p>
                  ) : (
                    <ul className="divide-y divide-gray-100">
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
                              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-gray-100">
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
                    <ul className="divide-y divide-gray-100">
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
            </>
          )}

          {data?.users && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard label="Comptes" value={data.users.total} hint={`${data.users.admins} administrateur(s)`} />
              <StatCard label="Nouveaux ce mois" value={data.users.new_this_month} />
              <StatCard
                label="Invitations en attente"
                value={data.invitations ? data.invitations.pending : '—'}
                hint={data.invitations ? <Link to="/invitations" className="text-primary hover:underline">Gérer</Link> : 'Module désactivé'}
                tone={data.invitations?.pending ? 'warn' : 'default'}
              />
              <StatCard label="Corbeille" value={data.users.trashed} hint={<Link to="/users?trashed=1" className="text-primary hover:underline">Voir les comptes supprimés</Link>} />
            </div>
          )}

          <div className={`grid gap-6 ${data?.signups ? 'lg:grid-cols-3' : ''}`}>
            <Card title="Activité récente" description={data?.is_admin ? "Dernières actions dans l'application." : 'Tes dernières actions.'} className={data?.signups ? 'lg:col-span-2' : ''} flush>
              {data?.recent_activity.length ? (
                <ul className="divide-y divide-gray-100">
                  {data.recent_activity.map((entry) => (
                    <li key={entry.id} className="flex items-start gap-3 px-5 py-3">
                      <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" aria-hidden />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-gray-800">{describeActivity(entry)}</p>
                        <p className="text-xs text-gray-500">{formatRelative(entry.created_at)}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState title="Aucune activité pour l'instant." />
              )}
            </Card>

            {data?.signups && (
              <Card title="Comptes créés" description="Sur les 6 derniers mois.">
                <div className="flex h-36 items-end gap-2">
                  {data.signups.map((month) => (
                    <div key={month.label} className="flex flex-1 flex-col items-center gap-1">
                      <span className="text-xs tabular-nums text-gray-600">{month.count}</span>
                      <div className="w-full rounded-t bg-primary/80" style={{ height: `${Math.max(4, (month.count / maxSignups) * 100)}%` }} title={`${month.label} : ${month.count}`} />
                      <span className="text-[11px] text-gray-500">{month.label}</span>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>
        </div>
      )}
    </>
  )
}
