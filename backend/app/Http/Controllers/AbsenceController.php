<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreAbsenceRequest;
use App\Http\Resources\AbsenceResource;
use App\Models\Absence;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

/**
 * Absences (vacances, maladie, école…). Lecture pour tous les connectés
 * (le planning grise les absents), écriture réservée aux planificateurs.
 */
class AbsenceController extends Controller
{
    /** ?from&to (défaut : 3 mois autour d'aujourd'hui), ?user_id. */
    public function index(Request $request): AnonymousResourceCollection
    {
        $filters = $request->validate([
            'from' => ['nullable', 'date_format:Y-m-d'],
            'to' => ['nullable', 'date_format:Y-m-d'],
            'user_id' => ['nullable', 'integer'],
        ]);
        $from = $filters['from'] ?? CarbonImmutable::today()->subMonth()->toDateString();
        $to = $filters['to'] ?? CarbonImmutable::today()->addMonths(2)->toDateString();

        $absences = Absence::query()
            ->with('user')
            ->overlapping($from, $to)
            ->when($filters['user_id'] ?? null, fn ($q, $id) => $q->where('user_id', $id))
            ->orderBy('start_date')
            ->get();

        return AbsenceResource::collection($absences);
    }

    public function store(StoreAbsenceRequest $request): JsonResponse
    {
        $absence = Absence::create([...$request->validated(), 'created_by' => $request->user()->id]);

        return AbsenceResource::make($absence->load('user'))->response()->setStatusCode(201);
    }

    public function update(StoreAbsenceRequest $request, Absence $absence): AbsenceResource
    {
        $absence->update($request->validated());

        return AbsenceResource::make($absence->fresh('user'));
    }

    public function destroy(Absence $absence): JsonResponse
    {
        $absence->delete();

        return response()->json(['message' => 'Absence supprimée.']);
    }
}
