<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreSignalementRequest;
use App\Http\Resources\SignalementResource;
use App\Models\Signalement;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

/**
 * Imprévus signalés depuis le chantier. Tout connecté peut en créer ; les
 * planificateurs les lisent et les marquent comme traités.
 */
class SignalementController extends Controller
{
    /** ?unread=1 pour les non traités seulement ; un ouvrier ne voit que les siens. */
    public function index(Request $request): AnonymousResourceCollection
    {
        $filters = $request->validate([
            'unread' => ['nullable', 'boolean'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);
        $user = $request->user();

        $items = Signalement::query()
            ->with(['user', 'affectation.chantier'])
            ->when(! $user->isPlanner(), fn ($q) => $q->where('user_id', $user->id))
            ->when($filters['unread'] ?? false, fn ($q) => $q->unread())
            ->orderByRaw('read_at is null desc')
            ->orderByDesc('created_at')
            ->paginate((int) ($filters['per_page'] ?? 20))
            ->withQueryString();

        return SignalementResource::collection($items);
    }

    public function store(StoreSignalementRequest $request): JsonResponse
    {
        $item = Signalement::create([...$request->validated(), 'user_id' => $request->user()->id]);

        return SignalementResource::make($item->load(['user', 'affectation.chantier']))->response()->setStatusCode(201);
    }

    /** Marque comme traité (planificateurs). */
    public function read(Request $request, Signalement $signalement): SignalementResource
    {
        if (! $signalement->read_at) {
            $signalement->update(['read_at' => now(), 'read_by' => $request->user()->id]);
        }

        return SignalementResource::make($signalement->fresh(['user', 'affectation.chantier']));
    }

    public function destroy(Request $request, Signalement $signalement): JsonResponse
    {
        $user = $request->user();
        if (! $user->isPlanner() && $signalement->user_id !== $user->id) {
            abort(403, 'Action non autorisée.');
        }
        $signalement->delete();

        return response()->json(['message' => 'Signalement supprimé.']);
    }
}
