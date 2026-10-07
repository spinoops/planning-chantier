<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreChantierRequest;
use App\Http\Requests\UpdateChantierRequest;
use App\Http\Resources\AffectationResource;
use App\Http\Resources\ChantierResource;
use App\Models\Chantier;
use App\Models\TimeEntry;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ChantierController extends Controller
{
    private const RELATIONS = ['clientRecord', 'sousTraitants'];

    /**
     * Liste paginée des chantiers.
     *
     * Filtres : ?search= (nom/client/adresse/ville), ?status=active|planned|paused|done,
     * ?open=1 (à venir + en cours, pour les sélecteurs), ?client_id=, ?sort=name|status|start_date|created_at,
     * ?dir=asc|desc, ?per_page=15 (max 200 pour alimenter le calendrier).
     */
    public function index(Request $request): AnonymousResourceCollection
    {
        $filters = $request->validate([
            'search' => ['nullable', 'string', 'max:100'],
            'status' => ['nullable', Rule::in(array_keys(Chantier::STATUSES))],
            'open' => ['nullable', 'boolean'],
            'client_id' => ['nullable', 'integer'],
            'sort' => ['nullable', Rule::in(['name', 'status', 'start_date', 'created_at'])],
            'dir' => ['nullable', Rule::in(['asc', 'desc'])],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:200'],
        ]);

        $chantiers = Chantier::query()
            ->with('clientRecord')
            ->withCount(['affectations', 'timeEntries'])
            ->search($filters['search'] ?? null)
            ->when($filters['status'] ?? null, fn ($q, $status) => $q->where('status', $status))
            ->when($filters['open'] ?? false, fn ($q) => $q->open())
            ->when($filters['client_id'] ?? null, fn ($q, $id) => $q->where('client_id', $id))
            ->orderBy($filters['sort'] ?? 'name', $filters['dir'] ?? 'asc')
            ->orderByDesc('id')
            ->paginate((int) ($filters['per_page'] ?? 15))
            ->withQueryString();

        return ChantierResource::collection($chantiers);
    }

    /** Fiche complète (client, sous-traitants, étapes). Lisible par tous les connectés (vue employé). */
    public function show(Chantier $chantier): ChantierResource
    {
        return ChantierResource::make($chantier->load(self::RELATIONS)->loadCount(['affectations', 'timeEntries']));
    }

    public function store(StoreChantierRequest $request): JsonResponse
    {
        $data = $request->validated();
        $chantier = DB::transaction(function () use ($data) {
            $chantier = Chantier::create($this->fields($data));
            $this->syncSousTraitants($chantier, $data);

            return $chantier;
        });

        return ChantierResource::make($chantier->load(self::RELATIONS)->loadCount(['affectations', 'timeEntries']))
            ->response()
            ->setStatusCode(201);
    }

    public function update(UpdateChantierRequest $request, Chantier $chantier): ChantierResource
    {
        $data = $request->validated();
        DB::transaction(function () use ($chantier, $data) {
            $chantier->update($this->fields($data));
            $this->syncSousTraitants($chantier, $data);
        });

        return ChantierResource::make($chantier->fresh(self::RELATIONS)->loadCount(['affectations', 'timeEntries']));
    }

    /**
     * Supprime un chantier (soft delete). Ses affectations restent en base
     * mais disparaissent du calendrier (relation filtrée par le SoftDeletes).
     */
    public function destroy(Chantier $chantier): JsonResponse
    {
        $chantier->delete();

        return response()->json(['message' => 'Chantier supprimé.']);
    }

    /**
     * Récapitulatif pour la facturation : heures pointées par personne (par statut),
     * heures planifiées, estimation, affectations, matériel et sous-traitants.
     * ?from&to limitent la période (sinon tout le chantier).
     */
    public function recap(Request $request, Chantier $chantier): JsonResponse
    {
        return response()->json($this->buildRecap($request, $chantier));
    }

    /** Même récapitulatif en CSV (séparateur ; pour Excel francophone). */
    public function recapCsv(Request $request, Chantier $chantier): StreamedResponse
    {
        $recap = $this->buildRecap($request, $chantier);
        $filename = 'recap-'.preg_replace('/[^a-z0-9]+/i', '-', strtolower($chantier->name)).'.csv';

        return response()->streamDownload(function () use ($recap, $chantier) {
            $out = fopen('php://output', 'w');
            fwrite($out, "\xEF\xBB\xBF"); // BOM UTF-8 pour Excel
            fputcsv($out, ['Chantier', $chantier->name], ';');
            fputcsv($out, ['Client', $recap['chantier']['client_record']['name'] ?? $recap['chantier']['client'] ?? ''], ';');
            fputcsv($out, ['Période', $recap['from'] ?? 'début', $recap['to'] ?? 'fin'], ';');
            fputcsv($out, [], ';');
            fputcsv($out, ['Personne', 'Heures validées', 'Heures soumises', 'Heures brouillon', 'Total heures', 'Pointages'], ';');
            foreach ($recap['by_user'] as $row) {
                fputcsv($out, [
                    $row['user']['name'],
                    self::hours($row['validated_minutes']),
                    self::hours($row['submitted_minutes']),
                    self::hours($row['draft_minutes']),
                    self::hours($row['worked_minutes']),
                    $row['entries'],
                ], ';');
            }
            fputcsv($out, ['Total', '', '', '', self::hours($recap['totals']['worked_minutes']), $recap['totals']['entries']], ';');
            fputcsv($out, [], ';');
            fputcsv($out, ['Heures planifiées', self::hours($recap['totals']['planned_minutes'])], ';');
            fputcsv($out, ['Estimation initiale (h)', $chantier->estimated_hours ?? ''], ';');
            fputcsv($out, ['Estimation planning (h)', $chantier->planning_hours ?? ''], ';');
            fputcsv($out, ['Devis', ($recap['chantier']['quote_status_label'] ?? ''), $chantier->quote_amount ?? ''], ';');
            fputcsv($out, [], ';');
            fputcsv($out, ['Date', 'Personne', 'Chantier', 'Début', 'Fin', 'Pause (min)', 'Heures', 'Statut', 'Commentaire'], ';');
            foreach ($recap['entries'] as $e) {
                fputcsv($out, [$e['date'], $e['user'], $chantier->name, $e['start_time'], $e['end_time'], $e['break_minutes'], self::hours($e['minutes']), $e['status_label'], $e['comment'] ?? ''], ';');
            }
            fclose($out);
        }, $filename, ['Content-Type' => 'text/csv; charset=UTF-8']);
    }

    /**
     * @return array<string, mixed>
     */
    private function buildRecap(Request $request, Chantier $chantier): array
    {
        $filters = $request->validate([
            'from' => ['nullable', 'date_format:Y-m-d'],
            'to' => ['nullable', 'date_format:Y-m-d'],
        ]);
        $from = $filters['from'] ?? null;
        $to = $filters['to'] ?? null;

        $entries = TimeEntry::with('user:id,name,color,job_title')
            ->where('chantier_id', $chantier->id)
            ->when($from, fn ($q) => $q->whereDate('date', '>=', $from))
            ->when($to, fn ($q) => $q->whereDate('date', '<=', $to))
            ->orderBy('date')->orderBy('start_time')
            ->get();

        $affectations = $chantier->affectations()
            ->with(['people:id,name,color', 'equipe'])
            ->withCount('photos')
            ->when($from, fn ($q) => $q->whereDate('date', '>=', $from))
            ->when($to, fn ($q) => $q->whereDate('date', '<=', $to))
            ->orderBy('date')->orderByRaw('start_time is null, start_time')
            ->get();

        $byUser = $entries->groupBy('user_id')->map(function ($group) {
            /** @var User|null $u */
            $u = $group->first()->user;
            $sum = fn (string $status) => $group->where('status', $status)->sum(fn (TimeEntry $e) => $e->minutes());

            return [
                'user' => $u ? ['id' => $u->id, 'name' => $u->name, 'color' => $u->color, 'job_title' => $u->job_title] : ['id' => 0, 'name' => 'Inconnu', 'color' => null, 'job_title' => null],
                'validated_minutes' => $sum('validated'),
                'submitted_minutes' => $sum('submitted'),
                'draft_minutes' => $sum('draft'),
                'worked_minutes' => $group->sum(fn (TimeEntry $e) => $e->minutes()),
                'entries' => $group->count(),
            ];
        })->sortBy('user.name')->values();

        $plannedMinutes = $affectations->sum(fn ($a) => $a->plannedMinutes() * max(1, $a->people->where('pivot.role', 'worker')->count()));
        $worked = $entries->sum(fn (TimeEntry $e) => $e->minutes());

        $chantier->load(self::RELATIONS)->loadCount(['affectations', 'timeEntries']);

        return [
            'chantier' => ChantierResource::make($chantier)->resolve(),
            'from' => $from,
            'to' => $to,
            'by_user' => $byUser,
            'totals' => [
                'worked_minutes' => $worked,
                'validated_minutes' => $entries->where('status', 'validated')->sum(fn (TimeEntry $e) => $e->minutes()),
                'planned_minutes' => $plannedMinutes,
                'estimated_minutes' => (int) round(($chantier->estimated_hours ?? 0) * 60),
                'planning_estimate_minutes' => (int) round(($chantier->planning_hours ?? 0) * 60),
                'entries' => $entries->count(),
                'days' => $affectations->pluck('date')->map(fn ($d) => $d->toDateString())->unique()->count(),
                'photos' => (int) $affectations->sum('photos_count'),
            ],
            'affectations' => AffectationResource::collection($affectations)->resolve(),
            'entries' => $entries->map(fn (TimeEntry $e) => [
                'id' => $e->id,
                'date' => $e->date->toDateString(),
                'user' => $e->user?->name,
                'start_time' => $e->start_time,
                'end_time' => $e->end_time,
                'break_minutes' => $e->break_minutes,
                'minutes' => $e->minutes(),
                'status' => $e->status,
                'status_label' => TimeEntry::STATUSES[$e->status] ?? $e->status,
                'comment' => $e->comment,
            ])->values(),
        ];
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    private function fields(array $data): array
    {
        $fields = collect($data)->except('sous_traitants')->all();
        if (isset($fields['materiel'])) {
            $fields['materiel'] = array_values(array_map(fn ($m) => ['label' => $m['label'], 'qty' => $m['qty'] ?? null, 'done' => (bool) ($m['done'] ?? false)], $fields['materiel']));
        }

        return $fields;
    }

    /**
     * @param  array<string, mixed>  $data
     */
    private function syncSousTraitants(Chantier $chantier, array $data): void
    {
        if (! array_key_exists('sous_traitants', $data)) {
            return;
        }
        $sync = [];
        foreach ($data['sous_traitants'] ?? [] as $row) {
            $sync[(int) $row['id']] = ['note' => $row['note'] ?? null, 'planned_date' => $row['planned_date'] ?? null];
        }
        $chantier->sousTraitants()->sync($sync);
    }

    private static function hours(int $minutes): string
    {
        return number_format($minutes / 60, 2, '.', '');
    }
}
