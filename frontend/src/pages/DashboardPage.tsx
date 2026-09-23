import { Link } from 'react-router-dom'
import { useAuth } from '@/auth/AuthContext'
import { useDashboard } from '@/hooks/useDashboard'
import { describeActivity } from '@/lib/activity'
import { formatLongDay, fromKey } from '@/lib/dates'
import { formatRelative } from '@/lib/format'
import Avatar from '@/components/ui/Avatar'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import EmptyState from '@/components/ui/EmptyState'
import PageHeader from '@/components/ui/PageHeader'
import Spinner from '@/components/ui/Spinner'
import StatCard from '@/components/ui/StatCard'
import AffectationCard from '@/components/planning/AffectationCard'

export default function DashboardPage() {
  const { user } = useAuth()
  const { data, isLoading } = useDashboard()

  const maxSignups = Math.max(1, ...(data?.signups?.map((s) => s.count) ?? [0]))
  const planning = data?.planning

  return (
    <>
      <PageHeader
        title={`Bonjour ${user?.name.split(' ')[0] ?? ''}`}
        subtitle={planning ? formatLongDay(fromKey(planning.today)) : "Voici un aperçu de l'application."}
        action={
          planning && (
            <Link
              to="/planning"
              className="hidden items-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 sm:inline-flex"
            >
              Ouvrir le planning
            </Link>
          )
        }
      />

      {isLoading ? (
        <Spinner block />
      ) : (
        <div className="space-y-6">
          {planning && (
            <>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard
                  label="Sur le terrain aujourd'hui"
                  value={`${planning.workers_assigned_today} / ${planning.workers_total}`}
                  hint="personnes affectées"
                  tone="primary"
                />
                <StatCard
                  label="Chantiers aujourd'hui"
                  value={planning.today_affectations.length}
                  hint={`${planning.week_affectations} affectation(s) cette semaine`}
                />
                <StatCard
                  label="Chantiers en cours"
                  value={planning.chantiers_active}
                  hint={<Link to="/chantiers" className="text-primary hover:underline">{planning.chantiers_planned} à venir</Link>}
                />
                <StatCard
                  label="Disponibles aujourd'hui"
                  value={planning.workers_free_today.length}
                  tone={planning.workers_free_today.length > 0 && planning.today_affectations.length > 0 ? 'warn' : 'default'}
                  hint="sans affectation"
                />
              </div>

              <div className="grid gap-6 lg:grid-cols-3">
                <Card
                  title="Aujourd'hui sur les chantiers"
                  description="Qui est où, et à quelle heure."
                  className="lg:col-span-2"
                  action={
                    <Link to="/planning?view=agenda" className="text-sm font-medium text-primary hover:underline">
                      Voir la semaine
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
              <StatCard
                label="Corbeille"
                value={data.users.trashed}
                hint={<Link to="/users?trashed=1" className="text-primary hover:underline">Voir les comptes supprimés</Link>}
              />
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
                      <div
                        className="w-full rounded-t bg-primary/80"
                        style={{ height: `${Math.max(4, (month.count / maxSignups) * 100)}%` }}
                        title={`${month.label} : ${month.count}`}
                      />
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
