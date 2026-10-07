<?php

namespace App\Http\Controllers;

use App\Http\Resources\ActivityResource;
use App\Http\Resources\AffectationResource;
use App\Http\Resources\SignalementResource;
use App\Models\Absence;
use App\Models\Affectation;
use App\Models\Chantier;
use App\Models\Invitation;
use App\Models\Signalement;
use App\Models\TimeEntry;
use App\Models\User;
use App\Support\Modules;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Spatie\Activitylog\Models\Activity;

class DashboardController extends Controller
{
    private const MONTHS_FR = ['', 'Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];

    /**
     * Données du tableau de bord.
     *
     * Un planificateur (admin / gestionnaire / chef) reçoit l'état du jour et le pilotage de la
     * semaine : qui est où, chantiers sans équipe, personnes libres, heures pointées
     * par chantier, imprévus non traités, heures à valider. Un admin reçoit en plus
     * les indicateurs du socle. Un ouvrier ne voit que sa propre activité récente.
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $isAdmin = $user->isAdmin();
        $isPlanner = $user->isPlanner();

        $activity = Activity::with(['causer', 'subject'])
            ->unless($isAdmin, fn ($q) => $q->where('causer_id', $user->id))
            ->orderByDesc('id')
            ->limit(8)
            ->get();

        $payload = [
            'is_admin' => $isAdmin,
            'is_planner' => $isPlanner,
            'recent_activity' => ActivityResource::collection($activity),
        ];

        if ($isPlanner) {
            $payload['planning'] = $this->planning();
            $payload['week'] = $this->week();
        }

        if ($isAdmin) {
            $payload['users'] = [
                'total' => User::count(),
                'admins' => User::role('admin')->count(),
                'new_this_month' => User::where('created_at', '>=', now()->startOfMonth())->count(),
                'trashed' => User::onlyTrashed()->count(),
            ];
            $payload['invitations'] = Modules::isEnabled('invitations')
                ? ['pending' => Invitation::pending()->count()]
                : null;
            $payload['signups'] = collect(range(5, 0))->map(function (int $back) {
                $month = now()->subMonthsNoOverflow($back);

                return [
                    'label' => self::MONTHS_FR[(int) $month->format('n')],
                    'count' => User::whereBetween('created_at', [
                        $month->copy()->startOfMonth(),
                        $month->copy()->endOfMonth(),
                    ])->count(),
                ];
            })->values();
        }

        return response()->json($payload);
    }

    /** État du jour. @return array<string, mixed> */
    private function planning(): array
    {
        $today = now()->toDateString();
        $todayAffectations = Affectation::with(['chantier', 'equipe', 'people'])
            ->withCount('photos')
            ->whereHas('chantier')
            ->whereDate('date', $today)
            ->orderByRaw('start_time is null, start_time')
            ->get();

        $assignedIds = $todayAffectations->flatMap(fn ($a) => $a->people->where('pivot.role', 'worker')->pluck('id'))->unique();
        $absentIds = Absence::absentUserIds($today);
        $team = User::assignable()->orderBy('name')->get(['id', 'name', 'job_title', 'color', 'phone']);

        $weekStart = now()->startOfWeek()->toDateString();
        $weekEnd = now()->endOfWeek()->toDateString();

        return [
            'today' => $today,
            'today_affectations' => AffectationResource::collection($todayAffectations),
            'workers_total' => $team->count(),
            'workers_assigned_today' => $assignedIds->count(),
            'workers_absent_today' => count($absentIds),
            'workers_free_today' => $team->whereNotIn('id', $assignedIds)->whereNotIn('id', $absentIds)->values()->map(fn ($w) => [
                'id' => $w->id,
                'name' => $w->name,
                'job_title' => $w->job_title,
                'color' => $w->color,
            ]),
            'chantiers_active' => Chantier::where('status', 'active')->count(),
            'chantiers_planned' => Chantier::where('status', 'planned')->count(),
            'week_affectations' => Affectation::whereHas('chantier')->whereBetween('date', [$weekStart, $weekEnd])->count(),
        ];
    }

    /** Pilotage de la semaine courante. @return array<string, mixed> */
    private function week(): array
    {
        $monday = CarbonImmutable::today()->startOfWeek();
        $from = $monday->toDateString();
        $to = $monday->addDays(6)->toDateString();

        $affectations = Affectation::with(['people:id', 'chantier:id,name,color'])->whereHas('chantier')->between($from, $to)->get();
        $entries = TimeEntry::with('chantier:id,name,color')->between($from, $to)->get();
        $absences = Absence::with('user:id,name,color')->overlapping($from, $to)->get();
        $team = User::assignable()->orderBy('name')->get(['id', 'name', 'color']);

        $days = collect(range(0, 6))->map(function (int $i) use ($monday, $affectations, $absences, $team) {
            $date = $monday->addDays($i)->toDateString();
            // `date` est casté en Carbon : comparer des chaînes, sinon aucun jour ne correspond.
            $ofDay = $affectations->filter(fn (Affectation $a) => $a->date->toDateString() === $date);
            $busy = $ofDay->flatMap(fn ($a) => $a->people->where('pivot.role', 'worker')->pluck('id'))->unique();
            $absent = $absences->filter(fn ($ab) => $ab->start_date->toDateString() <= $date && $ab->end_date->toDateString() >= $date)->pluck('user_id');

            return [
                'date' => $date,
                'affectations' => $ofDay->count(),
                'unstaffed' => $ofDay->filter(fn ($a) => $a->people->where('pivot.role', 'worker')->isEmpty())->count(),
                'free' => $team->whereNotIn('id', $busy)->whereNotIn('id', $absent)->map(fn ($u) => ['id' => $u->id, 'name' => $u->name, 'color' => $u->color])->values(),
                'absent' => $team->whereIn('id', $absent)->map(fn ($u) => ['id' => $u->id, 'name' => $u->name, 'color' => $u->color])->values(),
            ];
        });

        $hoursByChantier = $entries->groupBy('chantier_id')->map(function ($group) {
            $c = $group->first()->chantier;

            return [
                'chantier' => $c ? ['id' => $c->id, 'name' => $c->name, 'color' => $c->color] : ['id' => 0, 'name' => 'Sans chantier', 'color' => '#9ca3af'],
                'worked_minutes' => $group->sum(fn (TimeEntry $e) => $e->minutes()),
            ];
        })->sortByDesc('worked_minutes')->values();

        $plannedByChantier = $affectations->groupBy('chantier_id')->map(fn ($group) => $group->sum(fn (Affectation $a) => $a->plannedMinutes() * max(1, $a->people->where('pivot.role', 'worker')->count())));

        return [
            'from' => $from,
            'to' => $to,
            'days' => $days,
            'hours_by_chantier' => $hoursByChantier->map(fn ($row) => [...$row, 'planned_minutes' => $plannedByChantier[$row['chantier']['id']] ?? 0]),
            'worked_minutes' => $entries->sum(fn (TimeEntry $e) => $e->minutes()),
            'planned_minutes' => $plannedByChantier->sum(),
            'entries_to_validate' => $entries->where('status', 'submitted')->count(),
            'unread_signalements' => Signalement::unread()->count(),
            'latest_signalements' => SignalementResource::collection(Signalement::with(['user', 'affectation.chantier'])->unread()->latest()->limit(5)->get()),
            'absences' => $absences->map(fn ($ab) => [
                'id' => $ab->id,
                'user' => ['id' => $ab->user->id, 'name' => $ab->user->name, 'color' => $ab->user->color],
                'start_date' => $ab->start_date->toDateString(),
                'end_date' => $ab->end_date->toDateString(),
                'type' => $ab->type,
                'type_label' => Absence::TYPES[$ab->type] ?? $ab->type,
            ])->values(),
        ];
    }
}
