<?php

namespace App\Http\Controllers;

use App\Http\Resources\AffectationPhotoResource;
use App\Models\Affectation;
use App\Models\AffectationPhoto;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

/**
 * Photos de fin de journée d'une affectation (disque public, lien storage:link).
 * Les personnes de l'affectation et les planificateurs peuvent en ajouter.
 */
class AffectationPhotoController extends Controller
{
    public function index(Request $request, Affectation $affectation): AnonymousResourceCollection
    {
        $this->authorizeAccess($request, $affectation);

        return AffectationPhotoResource::collection($affectation->photos()->with('user')->get());
    }

    public function store(Request $request, Affectation $affectation): JsonResponse
    {
        $this->authorizeAccess($request, $affectation);
        $data = $request->validate([
            'file' => ['required', 'file', 'image', 'mimes:png,jpg,jpeg,webp,heic', 'max:8192'],
            'caption' => ['nullable', 'string', 'max:255'],
        ]);

        $path = $request->file('file')->store("affectations/{$affectation->id}", 'public');
        $photo = $affectation->photos()->create([
            'user_id' => $request->user()->id,
            'path' => $path,
            'caption' => $data['caption'] ?? null,
        ]);

        return AffectationPhotoResource::make($photo->load('user'))->response()->setStatusCode(201);
    }

    public function destroy(Request $request, Affectation $affectation, AffectationPhoto $photo): JsonResponse
    {
        $user = $request->user();
        if ($photo->affectation_id !== $affectation->id) {
            abort(404, 'Ressource introuvable.');
        }
        if (! $user->isPlanner() && $photo->user_id !== $user->id) {
            abort(403, 'Action non autorisée.');
        }
        $photo->delete();

        return response()->json(['message' => 'Photo supprimée.']);
    }

    private function authorizeAccess(Request $request, Affectation $affectation): void
    {
        $user = $request->user();
        if (! $user->isPlanner() && ! $affectation->people()->whereKey($user->id)->exists()) {
            abort(403, 'Action non autorisée.');
        }
    }
}
