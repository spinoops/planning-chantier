<?php

namespace App\Http\Controllers;

use App\Http\Requests\CopyWeekRequest;
use App\Http\Requests\StoreAffectationRequest;
use App\Http\Requests\UpdateAffectationRequest;
use App\Http\Resources\AffectationResource;
use App\Models\Affectation;
use App\Models\Equipe;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;

class PlanningController extends Controller
{
    private const RELATIONS = ['chantier', 'equipe', 'people'];

    /**
     * Affectations d'une période (calendrier).
     *
     * ?from=YYYY-MM-DD&to=YYYY-MM-DD (max 100 jours, par défaut la semaine courante)
     * ?chantier_id=, ?equipe_id= et ?worker_id= filtrent ; ?mine=1 limite à l'utilisateur connecté.
     * Un utilisateur non planificateur (ouvrier) ne voit que ses propres affectations.
     */
    public function index(Request $request): AnonymousResourceCollection
    {
        $filters = $request->validate([
            'from' => ['nullable', 'date_format:Y-m-d'],
            'to' => ['nullable', 'date_format:Y-m-d'],
            'chantier_id' => ['nullable', 'integer'],
            'equipe_id' => ['nullable', 'integer'],
            'worker_id' => ['nullable', 'integer'],
            'mine' => ['nullable', 'boolean'],
        ]);

        $from = isset($filters['from']) ? CarbonImmutable::parse($filters['from']) : CarbonImmutable::today()->startOfWeek();
        $to = isset($filters['to']) ? CarbonImmutable::parse($filters['to']) : $from->addDays(6);
        if ($to->lt($from)) {
            [$from, $to] = [$to, $from];
        }
        if ($from->diffInDays($to) > 100) {
            abort(422, 'La période demandée ne peut pas dépasser 100 jours.');
        }

        $user = $request->user();
        $onlyMine = ($filters['mine'] ?? false) || ! $user->isPlanner();

        $affectations = Affectation::query()
            ->with(self::RELATIONS)
            ->withCount('photos')
            ->whereHas('chantier')
            ->between($from->toDateString(), $to->toDateString())
            ->when($onlyMine, fn ($q) => $q->forWorker($user->id))
            ->when(! $onlyMine && ($filters['worker_id'] ?? null), fn ($q, $id) => $q->forWorker((int) $id))
            ->when($filters['chantier_id'] ?? null, fn ($q, $id) => $q->where('chantier_id', $id))
            ->when($filters['equipe_id'] ?? null, fn ($q, $id) => $q->where('equipe_id', $id))
            ->orderBy('date')
            ->orderByRaw('start_time is null, start_time')
            ->orderBy('id')
            ->get();

        return AffectationResource::collection($affectations)->additional([
            'meta' => ['from' => $from->toDateString(), 'to' => $to->toDateString()],
        ]);
    }

    public function show(Request $request, Affectation $affectation): AffectationResource
    {
        $user = $request->user();
        if (! $user->isPlanner() && ! $affectation->people()->whereKey($user->id)->exists()) {
            abort(403, 'Action non autorisée.');
        }

        return AffectationResource::make($affectation->load(self::RELATIONS)->loadCount('photos'));
    }

    /**
     * Crée une affectation. Sans `worker_ids`, l'équipe choisie fournit les
     * ouvriers (copie de ses membres à cet instant). Avec `repeat_until`, la
     * même affectation est répétée les jours `repeat_days` (défaut lun–ven).
     */
    public function store(StoreAffectationRequest $request): JsonResponse
    {
        $data = $request->validated();
        $fields = collect($data)->except(['worker_ids', 'visitor_ids', 'repeat_until', 'repeat_days'])->all();
        $workers = $this->resolveWorkers($data, $data['equipe_id'] ?? null);
        $visitors = array_values($data['visitor_ids'] ?? []);

        $dates = $this->repeatDates($data['date'], $data['repeat_until'] ?? null, $data['repeat_days'] ?? [1, 2, 3, 4, 5]);

        $created = DB::transaction(function () use ($fields, $workers, $visitors, $dates, $request) {
            $list = [];
            foreach ($dates as $date) {
                $affectation = Affectation::create([...$fields, 'date' => $date, 'created_by' => $request->user()->id]);
                $affectation->syncPeople($workers, $visitors);
                $list[] = $affectation;
            }

            return $list;
        });

        return AffectationResource::make($created[0]->load(self::RELATIONS)->loadCount('photos'))
            ->additional(['created' => count($created)])
            ->response()
            ->setStatusCode(201);
    }

    /**
     * Met à jour une affectation. Un changement d'équipe sans `worker_ids`
     * (glisser-déposer sur une autre ligne) remplace les ouvriers par les
     * membres de la nouvelle équipe.
     */
    public function update(UpdateAffectationRequest $request, Affectation $affectation): AffectationResource
    {
        $data = $request->validated();

        DB::transaction(function () use ($data, $affectation) {
            $previousEquipe = $affectation->equipe_id;
            $affectation->fill(collect($data)->except(['worker_ids', 'visitor_ids'])->all())->save();

            $currentWorkers = $affectation->workers()->pluck('users.id')->all();
            $currentVisitors = $affectation->visitors()->pluck('users.id')->all();

            $workers = $currentWorkers;
            if (array_key_exists('worker_ids', $data)) {
                $workers = array_values($data['worker_ids']);
            } elseif (array_key_exists('equipe_id', $data) && $data['equipe_id'] !== $previousEquipe) {
                $workers = $this->resolveWorkers([], $data['equipe_id']);
            }
            $visitors = array_key_exists('visitor_ids', $data) ? array_values($data['visitor_ids']) : $currentVisitors;

            if ($workers !== $currentWorkers || $visitors !== $currentVisitors) {
                $affectation->syncPeople($workers, $visitors);
            }
        });

        return AffectationResource::make($affectation->fresh(self::RELATIONS)->loadCount('photos'));
    }

    public function destroy(Affectation $affectation): JsonResponse
    {
        $affectation->delete();

        return response()->json(['message' => 'Affectation supprimée.']);
    }

    /**
     * Duplique toutes les affectations de la semaine `from` (lundi) sur la
     * semaine `to` (lundi), en conservant chantiers, équipes, horaires, notes,
     * ouvriers et passages. Avec `replace`, la semaine cible est d'abord vidée.
     */
    public function copyWeek(CopyWeekRequest $request): JsonResponse
    {
        $data = $request->validated();
        $from = CarbonImmutable::parse($data['from'])->startOfWeek();
        $to = CarbonImmutable::parse($data['to'])->startOfWeek();
        $offset = $from->diffInDays($to, false);

        $source = Affectation::query()
            ->with('people:id')
            ->whereHas('chantier')
            ->between($from->toDateString(), $from->addDays(6)->toDateString())
            ->get();

        $created = DB::transaction(function () use ($source, $to, $offset, $data, $request) {
            if ($data['replace'] ?? false) {
                Affectation::between($to->toDateString(), $to->addDays(6)->toDateString())->delete();
            }

            $count = 0;
            foreach ($source as $item) {
                $copy = Affectation::create([
                    'chantier_id' => $item->chantier_id,
                    'equipe_id' => $item->equipe_id,
                    'date' => $item->date->addDays($offset)->toDateString(),
                    'start_time' => $item->start_time,
                    'end_time' => $item->end_time,
                    'note' => $item->note,
                    'phase' => $item->phase,
                    'created_by' => $request->user()->id,
                ]);
                $copy->syncPeople(
                    $item->people->where('pivot.role', 'worker')->pluck('id')->all(),
                    $item->people->where('pivot.role', 'visit')->pluck('id')->all(),
                );
                $count++;
            }

            return $count;
        });

        return response()->json([
            'message' => $created > 0 ? "{$created} affectation(s) copiée(s)." : 'Aucune affectation à copier sur la semaine source.',
            'created' => $created,
        ]);
    }

    /**
     * Ouvriers d'une affectation : ceux fournis, sinon les membres de l'équipe.
     *
     * @param  array<string, mixed>  $data
     * @return list<int>
     */
    private function resolveWorkers(array $data, ?int $equipeId): array
    {
        if (array_key_exists('worker_ids', $data)) {
            return array_values($data['worker_ids']);
        }
        if ($equipeId === null) {
            return [];
        }

        return Equipe::find($equipeId)?->members()->pluck('users.id')->all() ?? [];
    }

    /**
     * Dates à créer : la date de départ, puis chaque jour autorisé jusqu'à `until` (90 jours max).
     *
     * @param  list<int>  $days  jours ISO (1 = lundi … 7 = dimanche)
     * @return list<string>
     */
    private function repeatDates(string $start, ?string $until, array $days): array
    {
        $dates = [$start];
        if (! $until) {
            return $dates;
        }
        $cursor = CarbonImmutable::parse($start)->addDay();
        $end = min(CarbonImmutable::parse($until), CarbonImmutable::parse($start)->addDays(90));
        while ($cursor->lte($end)) {
            if (in_array($cursor->dayOfWeekIso, $days, true)) {
                $dates[] = $cursor->toDateString();
            }
            $cursor = $cursor->addDay();
        }

        return $dates;
    }
}
