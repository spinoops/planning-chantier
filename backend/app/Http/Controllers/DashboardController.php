<?php

namespace App\Http\Controllers;

use App\Http\Resources\ActivityResource;
use App\Http\Resources\AffectationResource;
use App\Models\Affectation;
use App\Models\Chantier;
use App\Models\Invitation;
use App\Models\User;
use App\Support\Modules;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Spatie\Activitylog\Models\Activity;

class DashboardController extends Controller
{
    private const MONTHS_FR = ['', 'Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];

    /**
     * Données du tableau de bord.
     *
     * Un planificateur (admin / chef) reçoit l'état du jour sur les chantiers :
     * affectations d'aujourd'hui, effectif mobilisé, ouvriers sans affectation,
     * chantiers en cours. Un admin reçoit en plus les indicateurs du socle.
     * Un ouvrier ne voit que sa propre activité récente (sa page est « Mon planning »).
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
            $today = now()->toDateString();
            $todayAffectations = Affectation::with(['chantier', 'workers'])
                ->whereHas('chantier')
                ->whereDate('date', $today)
                ->orderByRaw('start_time is null, start_time')
                ->get();

            $assignedIds = $todayAffectations->flatMap(fn ($a) => $a->workers->pluck('id'))->unique();
            $team = User::assignable()->orderBy('name')->get(['id', 'name', 'job_title', 'color', 'phone']);

            $weekStart = now()->startOfWeek()->toDateString();
            $weekEnd = now()->endOfWeek()->toDateString();

            $payload['planning'] = [
                'today' => $today,
                'today_affectations' => AffectationResource::collection($todayAffectations),
                'workers_total' => $team->count(),
                'workers_assigned_today' => $assignedIds->count(),
                'workers_free_today' => $team->whereNotIn('id', $assignedIds)->values()->map(fn ($w) => [
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
            // Comptes créés par mois sur les 6 derniers mois (mini-graphique).
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
}
