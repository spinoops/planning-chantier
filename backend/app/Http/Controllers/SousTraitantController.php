<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreSousTraitantRequest;
use App\Http\Resources\SousTraitantResource;
use App\Models\SousTraitant;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

/**
 * Sous-traitants (électricien, sanitaire…). Liste complète pour les connectés,
 * écriture réservée aux planificateurs.
 */
class SousTraitantController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $filters = $request->validate(['search' => ['nullable', 'string', 'max:100']]);

        return SousTraitantResource::collection(
            SousTraitant::query()->withCount('chantiers')->search($filters['search'] ?? null)->orderBy('name')->get(),
        );
    }

    public function store(StoreSousTraitantRequest $request): JsonResponse
    {
        $item = SousTraitant::create($request->validated());

        return SousTraitantResource::make($item)->response()->setStatusCode(201);
    }

    public function update(StoreSousTraitantRequest $request, SousTraitant $sousTraitant): SousTraitantResource
    {
        $sousTraitant->update($request->validated());

        return SousTraitantResource::make($sousTraitant->loadCount('chantiers'));
    }

    public function destroy(SousTraitant $sousTraitant): JsonResponse
    {
        $sousTraitant->delete();

        return response()->json(['message' => 'Sous-traitant supprimé.']);
    }
}
