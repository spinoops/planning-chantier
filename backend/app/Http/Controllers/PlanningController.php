<?php

namespace App\Http\Controllers;

use App\Http\Requests\CopyWeekRequest;
use App\Http\Requests\StoreAffectationRequest;
use App\Http\Requests\UpdateAffectationRequest;
use App\Http\Resources\AffectationResource;
use App\Models\Affectation;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;

class PlanningController extends Controller
{
    /**
     * Affectations d'une période (calendrier).
     *
     * ?from=YYYY-MM-DD&to=YYYY-MM-DD (max 100 jours, par défaut la semaine courante)
     * ?chantier_id= et ?worker_id= filtrent ; ?mine=1 limite à l'utilisateur connecté.
     * Un utilisateur non planificateur (ouvrier) ne voit que ses propres affectations.
     */
    public function index(Request $request): AnonymousResourceCollection
    {
        $filters = $request->validate([
            'from' => ['nullable', 'date_format:Y-m-d'],
            'to' => ['nullable', 'date_format:Y-m-d'],
            'chantier_id' => ['nullable', 'integer'],
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
            ->with(['chantier', 'workers'])
            ->whereHas('chantier')
            ->between($from->toDateString(), $to->toDateString())
            ->when($onlyMine, fn ($q) => $q->forWorker($user->id))
            ->when(! $onlyMine && ($filters['worker_id'] ?? null), fn ($q, $id) => $q->forWorker((int) $id))
            ->when($filters['chantier_id'] ?? null, fn ($q, $id) => $q->where('chantier_id', $id))
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
        if (! $user->isPlanner() && ! $affectation->workers()->whereKey($user->id)->exists()) {
            abort(403, 'Action non autorisée.');
        }

        return AffectationResource::make($affectation->load(['chantier', 'workers']));
    }

    public function store(StoreAffectationRequest $request): JsonResponse
    {
        $data = $request->validated();

        $affectation = DB::transaction(function () use ($data, $request) {
            $affectation = Affectation::create([
                ...collect($data)->except('worker_ids')->all(),
                'created_by' => $request->user()->id,
            ]);
            $affectation->workers()->sync($data['worker_ids']);

            return $affectation;
        });

        return AffectationResource::make($affectation->load(['chantier', 'workers']))
            ->response()
            ->setStatusCode(201);
    }

    public function update(UpdateAffectationRequest $request, Affectation $affectation): AffectationResource
    {
        $data = $request->validated();

        DB::transaction(function () use ($data, $affectation) {
            $affectation->fill(collect($data)->except('worker_ids')->all())->save();
            if (array_key_exists('worker_ids', $data)) {
                $affectation->workers()->sync($data['worker_ids']);
            }
        });

        return AffectationResource::make($affectation->fresh(['chantier', 'workers']));
    }

    public function destroy(Affectation $affectation): JsonResponse
    {
        $affectation->delete();

        return response()->json(['message' => 'Affectation supprimée.']);
    }

    /**
     * Duplique toutes les affectations de la semaine `from` (lundi) sur la
     * semaine `to` (lundi), en conservant chantiers, horaires, notes et équipes.
     * Avec `replace`, la semaine cible est d'abord vidée.
     */
    public function copyWeek(CopyWeekRequest $request): JsonResponse
    {
        $data = $request->validated();
        $from = CarbonImmutable::parse($data['from'])->startOfWeek();
        $to = CarbonImmutable::parse($data['to'])->startOfWeek();
        $offset = $from->diffInDays($to, false);

        $source = Affectation::query()
            ->with('workers:id')
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
                    'date' => $item->date->addDays($offset)->toDateString(),
                    'start_time' => $item->start_time,
                    'end_time' => $item->end_time,
                    'note' => $item->note,
                    'created_by' => $request->user()->id,
                ]);
                $copy->workers()->sync($item->workers->pluck('id'));
                $count++;
            }

            return $count;
        });

        return response()->json([
            'message' => $created > 0 ? "{$created} affectation(s) copiée(s)." : 'Aucune affectation à copier sur la semaine source.',
            'created' => $created,
        ]);
    }
}
