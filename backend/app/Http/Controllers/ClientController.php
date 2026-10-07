<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreClientRequest;
use App\Http\Resources\ClientResource;
use App\Models\Client;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Validation\Rule;

/**
 * Clients (donneurs d'ordre). Lecture pour les connectés (sélecteur de la fiche
 * chantier), écriture réservée aux planificateurs.
 */
class ClientController extends Controller
{
    /** ?search=, ?sort=name|city|created_at, ?dir=, ?per_page= (max 200 pour les sélecteurs). */
    public function index(Request $request): AnonymousResourceCollection
    {
        $filters = $request->validate([
            'search' => ['nullable', 'string', 'max:100'],
            'sort' => ['nullable', Rule::in(['name', 'city', 'created_at'])],
            'dir' => ['nullable', Rule::in(['asc', 'desc'])],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:200'],
        ]);

        $clients = Client::query()
            ->withCount('chantiers')
            ->search($filters['search'] ?? null)
            ->orderBy($filters['sort'] ?? 'name', $filters['dir'] ?? 'asc')
            ->paginate((int) ($filters['per_page'] ?? 15))
            ->withQueryString();

        return ClientResource::collection($clients);
    }

    public function show(Client $client): ClientResource
    {
        return ClientResource::make($client->loadCount('chantiers'));
    }

    public function store(StoreClientRequest $request): JsonResponse
    {
        $client = Client::create($request->validated());

        return ClientResource::make($client)->response()->setStatusCode(201);
    }

    public function update(StoreClientRequest $request, Client $client): ClientResource
    {
        $client->update($request->validated());

        return ClientResource::make($client->loadCount('chantiers'));
    }

    public function destroy(Client $client): JsonResponse
    {
        $client->delete();

        return response()->json(['message' => 'Client supprimé.']);
    }
}
