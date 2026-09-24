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
    private const RELATIONS = ['chantier', 'equipe', 'workers'];

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
        if (! $user->isPlanner() && ! $affectation->workers()->whereKey($user->id)->exists()) {
            abort(403, 'Action non autorisée.');
        }

        return AffectationResource::make($affectation->load(self::RELATIONS));
    }

    /**
     * Crée une affectation. Sans `worker_ids`, l'équipe choisie fournit les
     * ouvriers (copie de ses membres à cet instant).
     */
    public function store(StoreAffectationRequest $request): JsonResponse
    {
        $data = $request->validated();

        $affectation = DB::transaction(function () use ($data, $request) {
            $affectation = Affectation::create([
                ...collect($data)->except('worker_ids')->all(),
                'created_by' => $request->user()->id,
            ]);
            $affectation->workers()->sync($this->resolveWorkers($data, $data['equipe_id'] ?? null));

            return $affectation;
        });

        return AffectationResource::make($affectation->load(self::RELATIONS))
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
            $affectation->fill(collect($data)->except('worker_ids')->all())->save();

            if (array_key_exists('worker_ids', $data)) {
                $affectation->workers()->sync($data['worker_ids']);
            } elseif (array_key_exists('equipe_id', $data) && $data['equipe_id'] !== $previousEquipe) {
                $affectation->workers()->sync($this->resolveWorkers([], $data['equipe_id']));
            }
        });

        return AffectationResource::make($affectation->fresh(self::RELATIONS));
    }

    public function destroy(Affectation $affectation): JsonResponse
    {
        $affectation->delete();

        return response()->json(['message' => 'Affectation supprimée.']);
    }

    /**
     * Duplique toutes les affectations de la semaine `from` (lundi) sur la
     * semaine `to` (lundi), en conservant chantiers, équipes, horaires, notes
     * et ouvriers. Avec `replace`, la semaine cible est d'abord vidée.
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
                    'equipe_id' => $item->equipe_id,
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
}
