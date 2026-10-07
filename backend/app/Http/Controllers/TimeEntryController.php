<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreTimeEntryRequest;
use App\Http\Requests\UpdateTimeEntryRequest;
use App\Http\Resources\TimeEntryResource;
use App\Models\Affectation;
use App\Models\TimeEntry;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Heures pointées. Un ouvrier gère ses propres heures (brouillon → soumis) ;
 * un planificateur voit tout, valide et peut corriger.
 */
class TimeEntryController extends Controller
{
    private const RELATIONS = ['user', 'chantier', 'validator'];

    /**
     * ?from&to (défaut : semaine courante, max 100 jours), ?user_id, ?chantier_id, ?status.
     */
    public function index(Request $request): AnonymousResourceCollection
    {
        $filters = $request->validate([
            'from' => ['nullable', 'date_format:Y-m-d'],
            'to' => ['nullable', 'date_format:Y-m-d'],
            'user_id' => ['nullable', 'integer'],
            'chantier_id' => ['nullable', 'integer'],
            'status' => ['nullable', Rule::in(array_keys(TimeEntry::STATUSES))],
        ]);
        [$from, $to] = $this->range($filters);
        $user = $request->user();

        $entries = TimeEntry::query()
            ->with(self::RELATIONS)
            ->between($from, $to)
            ->when(! $user->isPlanner(), fn ($q) => $q->where('user_id', $user->id))
            ->when($user->isPlanner() && ($filters['user_id'] ?? null), fn ($q, $id) => $q->where('user_id', $id))
            ->when($filters['chantier_id'] ?? null, fn ($q, $id) => $q->where('chantier_id', $id))
            ->when($filters['status'] ?? null, fn ($q, $s) => $q->where('status', $s))
            ->orderBy('date')
            ->orderBy('start_time')
            ->get();

        return TimeEntryResource::collection($entries)->additional(['meta' => ['from' => $from, 'to' => $to]]);
    }

    public function store(StoreTimeEntryRequest $request): JsonResponse
    {
        $data = $request->validated();
        $user = $request->user();

        // Un ouvrier ne pointe que pour lui-même.
        $userId = $user->isPlanner() && ! empty($data['user_id']) ? (int) $data['user_id'] : $user->id;

        $affectation = ! empty($data['affectation_id']) ? Affectation::find($data['affectation_id']) : null;
        if ($affectation && ! $user->isPlanner() && ! $affectation->people()->whereKey($user->id)->exists()) {
            abort(403, 'Tu ne figures pas sur cette affectation.');
        }

        $entry = TimeEntry::create([
            'user_id' => $userId,
            'affectation_id' => $affectation?->id,
            'chantier_id' => $data['chantier_id'] ?? $affectation?->chantier_id,
            'date' => $data['date'],
            'start_time' => $data['start_time'],
            'end_time' => $data['end_time'],
            'break_minutes' => $data['break_minutes'] ?? 0,
            'comment' => $data['comment'] ?? null,
            'status' => 'draft',
        ]);

        return TimeEntryResource::make($entry->load(self::RELATIONS))->response()->setStatusCode(201);
    }

    public function update(UpdateTimeEntryRequest $request, TimeEntry $timeEntry): TimeEntryResource
    {
        $this->authorizeEntry($request, $timeEntry);
        $data = collect($request->validated())->except('user_id')->all();

        if (! empty($data['affectation_id'])) {
            $data['chantier_id'] = $data['chantier_id'] ?? Affectation::find($data['affectation_id'])?->chantier_id;
        }
        // Une correction remet l'entrée en brouillon (sauf pour un planificateur, qui corrige en place).
        if (! $request->user()->isPlanner() && $timeEntry->status === 'submitted') {
            $data['status'] = 'draft';
        }
        $timeEntry->update($data);

        return TimeEntryResource::make($timeEntry->fresh(self::RELATIONS));
    }

    public function destroy(Request $request, TimeEntry $timeEntry): JsonResponse
    {
        $this->authorizeEntry($request, $timeEntry);
        $timeEntry->delete();

        return response()->json(['message' => 'Heures supprimées.']);
    }

    /** Un ouvrier soumet ses brouillons (ids) ; ils ne sont plus modifiables qu'en les rouvrant. */
    public function submit(Request $request): JsonResponse
    {
        $ids = $this->ids($request);
        $user = $request->user();
        $count = TimeEntry::whereIn('id', $ids)
            ->where('status', 'draft')
            ->when(! $user->isPlanner(), fn ($q) => $q->where('user_id', $user->id))
            ->update(['status' => 'submitted']);

        return response()->json(['message' => "{$count} entrée(s) soumise(s).", 'count' => $count]);
    }

    /** Un planificateur valide des heures soumises (ou brouillon). */
    public function validateEntries(Request $request): JsonResponse
    {
        $ids = $this->ids($request);
        $count = TimeEntry::whereIn('id', $ids)
            ->where('status', '!=', 'validated')
            ->update(['status' => 'validated', 'validated_by' => $request->user()->id, 'validated_at' => now()]);

        return response()->json(['message' => "{$count} entrée(s) validée(s).", 'count' => $count]);
    }

    /** Un planificateur rouvre des heures validées (retour en brouillon). */
    public function reopen(Request $request): JsonResponse
    {
        $ids = $this->ids($request);
        $count = TimeEntry::whereIn('id', $ids)
            ->update(['status' => 'draft', 'validated_by' => null, 'validated_at' => null]);

        return response()->json(['message' => "{$count} entrée(s) rouverte(s).", 'count' => $count]);
    }

    /**
     * Synthèse d'une période (planificateurs) pour la rubrique Statistiques → Heures :
     *   - by_user : planifié vs pointé, minutes et nombre d'entrées par statut, jours pointés,
     *     jours planifiés passés sans pointage (oublis) ;
     *   - grid : une cellule par personne et par jour non vide (planifié, pointé, statuts) ;
     *   - by_chantier : minutes pointées par chantier ;
     *   - totals.
     */
    public function summary(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'from' => ['nullable', 'date_format:Y-m-d'],
            'to' => ['nullable', 'date_format:Y-m-d'],
        ]);
        [$from, $to] = $this->range($filters);
        $today = CarbonImmutable::today()->toDateString();

        $entries = TimeEntry::with('chantier:id,name,color')->between($from, $to)->get();
        $planned = Affectation::with('people:id')->whereHas('chantier')->between($from, $to)->get();

        // Cellules personne × jour.
        $cells = [];
        $cell = function (int $userId, string $date) use (&$cells): string {
            $key = $userId.'|'.$date;
            $cells[$key] ??= [
                'user_id' => $userId,
                'date' => $date,
                'planned_minutes' => 0,
                'planned' => 0,
                'worked_minutes' => 0,
                'entries' => 0,
                'draft' => 0,
                'submitted' => 0,
                'validated' => 0,
            ];

            return $key;
        };
        foreach ($planned as $a) {
            foreach ($a->people as $p) {
                if ($p->pivot->role !== 'worker') {
                    continue;
                }
                $k = $cell($p->id, $a->date->toDateString());
                $cells[$k]['planned_minutes'] += $a->plannedMinutes();
                $cells[$k]['planned']++;
            }
        }
        foreach ($entries as $e) {
            $k = $cell($e->user_id, $e->date->toDateString());
            $cells[$k]['worked_minutes'] += $e->minutes();
            $cells[$k]['entries']++;
            $cells[$k][$e->status]++;
        }
        $grid = collect($cells)->sortBy([['date', 'asc'], ['user_id', 'asc']])->values();

        $people = User::assignable()->orderBy('name')->get(['id', 'name', 'color', 'job_title']);
        $byUser = $people->map(function (User $u) use ($entries, $grid, $today) {
            $mine = $entries->where('user_id', $u->id);
            $myCells = $grid->where('user_id', $u->id);
            $minutes = fn (string $status) => $mine->where('status', $status)->sum(fn (TimeEntry $e) => $e->minutes());

            return [
                'user' => ['id' => $u->id, 'name' => $u->name, 'color' => $u->color, 'job_title' => $u->job_title],
                'planned_minutes' => $myCells->sum('planned_minutes'),
                'worked_minutes' => $mine->sum(fn (TimeEntry $e) => $e->minutes()),
                'draft_minutes' => $minutes('draft'),
                'submitted_minutes' => $minutes('submitted'),
                'validated_minutes' => $minutes('validated'),
                'entries' => $mine->count(),
                'draft' => $mine->where('status', 'draft')->count(),
                'submitted' => $mine->where('status', 'submitted')->count(),
                'validated' => $mine->where('status', 'validated')->count(),
                'days_worked' => $myCells->where('entries', '>', 0)->count(),
                'days_planned' => $myCells->where('planned', '>', 0)->count(),
                'missing_days' => $myCells->filter(fn ($c) => $c['planned'] > 0 && $c['entries'] === 0 && $c['date'] < $today)->count(),
            ];
        })->values();

        $byChantier = $entries->groupBy('chantier_id')->map(function ($group, $chantierId) {
            $chantier = $group->first()->chantier;

            return [
                'chantier' => $chantier ? ['id' => $chantier->id, 'name' => $chantier->name, 'color' => $chantier->color] : ['id' => (int) $chantierId, 'name' => 'Sans chantier', 'color' => '#9ca3af'],
                'worked_minutes' => $group->sum(fn (TimeEntry $e) => $e->minutes()),
                'entries' => $group->count(),
            ];
        })->sortByDesc('worked_minutes')->values();

        return response()->json([
            'from' => $from,
            'to' => $to,
            'by_user' => $byUser,
            'grid' => $grid,
            'by_chantier' => $byChantier,
            'totals' => [
                'worked_minutes' => $entries->sum(fn (TimeEntry $e) => $e->minutes()),
                'planned_minutes' => $grid->sum('planned_minutes'),
                'validated_minutes' => $byUser->sum('validated_minutes'),
                'entries' => $entries->count(),
                'submitted' => $entries->where('status', 'submitted')->count(),
                'draft' => $entries->where('status', 'draft')->count(),
                'validated' => $entries->where('status', 'validated')->count(),
                'missing_days' => $byUser->sum('missing_days'),
            ],
        ]);
    }

    /**
     * Export CSV d'une période (planificateurs) : totaux par personne puis détail des
     * pointages, pour les salaires. ?from&to[&user_id].
     */
    public function export(Request $request): StreamedResponse
    {
        $filters = $request->validate([
            'from' => ['nullable', 'date_format:Y-m-d'],
            'to' => ['nullable', 'date_format:Y-m-d'],
            'user_id' => ['nullable', 'integer'],
        ]);
        [$from, $to] = $this->range($filters);

        $entries = TimeEntry::with(['user:id,name', 'chantier:id,name'])
            ->between($from, $to)
            ->when($filters['user_id'] ?? null, fn ($q, $id) => $q->where('user_id', $id))
            ->orderBy('date')
            ->orderBy('start_time')
            ->get();
        $hours = fn (int $m) => number_format($m / 60, 2, '.', '');

        return response()->streamDownload(function () use ($entries, $from, $to, $hours) {
            $out = fopen('php://output', 'w');
            fwrite($out, "\xEF\xBB\xBF"); // BOM UTF-8 pour Excel
            fputcsv($out, ['Heures pointées', $from, $to], ';');
            fputcsv($out, [], ';');
            fputcsv($out, ['Personne', 'Heures validées', 'Heures soumises', 'Heures brouillon', 'Total heures', 'Jours', 'Pointages'], ';');
            foreach ($entries->groupBy('user_id') as $group) {
                $by = fn (string $s) => $group->where('status', $s)->sum(fn (TimeEntry $e) => $e->minutes());
                fputcsv($out, [
                    $group->first()->user?->name ?? '—',
                    $hours($by('validated')),
                    $hours($by('submitted')),
                    $hours($by('draft')),
                    $hours($group->sum(fn (TimeEntry $e) => $e->minutes())),
                    $group->map(fn (TimeEntry $e) => $e->date->toDateString())->unique()->count(),
                    $group->count(),
                ], ';');
            }
            fputcsv($out, ['Total', '', '', '', $hours($entries->sum(fn (TimeEntry $e) => $e->minutes())), '', $entries->count()], ';');
            fputcsv($out, [], ';');
            fputcsv($out, ['Date', 'Personne', 'Chantier', 'Début', 'Fin', 'Pause (min)', 'Heures', 'Statut', 'Commentaire'], ';');
            foreach ($entries as $e) {
                fputcsv($out, [
                    $e->date->toDateString(),
                    $e->user?->name ?? '—',
                    $e->chantier?->name ?? 'Sans chantier',
                    $e->start_time,
                    $e->end_time,
                    $e->break_minutes,
                    $hours($e->minutes()),
                    TimeEntry::STATUSES[$e->status] ?? $e->status,
                    $e->comment ?? '',
                ], ';');
            }
            fclose($out);
        }, "heures-{$from}-{$to}.csv", ['Content-Type' => 'text/csv; charset=UTF-8']);
    }

    /**
     * @param  array<string, mixed>  $filters
     * @return array{0: string, 1: string}
     */
    private function range(array $filters): array
    {
        $from = isset($filters['from']) ? CarbonImmutable::parse($filters['from']) : CarbonImmutable::today()->startOfWeek();
        $to = isset($filters['to']) ? CarbonImmutable::parse($filters['to']) : $from->addDays(6);
        if ($to->lt($from)) {
            [$from, $to] = [$to, $from];
        }
        if ($from->diffInDays($to) > 100) {
            abort(422, 'La période demandée ne peut pas dépasser 100 jours.');
        }

        return [$from->toDateString(), $to->toDateString()];
    }

    /** @return list<int> */
    private function ids(Request $request): array
    {
        return $request->validate(['ids' => ['required', 'array', 'min:1'], 'ids.*' => ['integer']])['ids'];
    }

    private function authorizeEntry(Request $request, TimeEntry $entry): void
    {
        $user = $request->user();
        if ($user->isPlanner()) {
            return;
        }
        if ($entry->user_id !== $user->id) {
            abort(403, 'Action non autorisée.');
        }
        if ($entry->isLocked()) {
            abort(422, 'Ces heures sont validées : demande au bureau de les rouvrir.');
        }
    }
}
