<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreChantierRequest;
use App\Http\Requests\UpdateChantierRequest;
use App\Http\Resources\ChantierResource;
use App\Models\Chantier;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Validation\Rule;

class ChantierController extends Controller
{
    /**
     * Liste paginée des chantiers.
     *
     * Filtres : ?search= (nom/client/adresse/ville), ?status=active|planned|paused|done,
     * ?open=1 (à venir + en cours, pour les sélecteurs), ?sort=name|status|start_date|created_at,
     * ?dir=asc|desc, ?per_page=15 (max 200 pour alimenter le calendrier).
     */
    public function index(Request $request): AnonymousResourceCollection
    {
        $filters = $request->validate([
            'search' => ['nullable', 'string', 'max:100'],
            'status' => ['nullable', Rule::in(array_keys(Chantier::STATUSES))],
            'open' => ['nullable', 'boolean'],
            'sort' => ['nullable', Rule::in(['name', 'status', 'start_date', 'created_at'])],
            'dir' => ['nullable', Rule::in(['asc', 'desc'])],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:200'],
        ]);

        $chantiers = Chantier::query()
            ->withCount('affectations')
            ->search($filters['search'] ?? null)
            ->when($filters['status'] ?? null, fn ($q, $status) => $q->where('status', $status))
            ->when($filters['open'] ?? false, fn ($q) => $q->open())
            ->orderBy($filters['sort'] ?? 'name', $filters['dir'] ?? 'asc')
            ->orderByDesc('id')
            ->paginate((int) ($filters['per_page'] ?? 15))
            ->withQueryString();

        return ChantierResource::collection($chantiers);
    }

    public function show(Chantier $chantier): ChantierResource
    {
        return ChantierResource::make($chantier->loadCount('affectations'));
    }

    public function store(StoreChantierRequest $request): JsonResponse
    {
        $chantier = Chantier::create($request->validated());

        return ChantierResource::make($chantier)
            ->response()
            ->setStatusCode(201);
    }

    public function update(UpdateChantierRequest $request, Chantier $chantier): ChantierResource
    {
        $chantier->update($request->validated());

        return ChantierResource::make($chantier->loadCount('affectations'));
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
}
