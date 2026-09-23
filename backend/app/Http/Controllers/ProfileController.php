<?php

namespace App\Http\Controllers;

use App\Http\Requests\UpdatePasswordRequest;
use App\Http\Requests\UpdateProfileRequest;
use App\Http\Resources\UserResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\PersonalAccessToken;

class ProfileController extends Controller
{
    /**
     * Met à jour le nom et l'email de l'utilisateur connecté.
     */
    public function update(UpdateProfileRequest $request): JsonResponse
    {
        $user = $request->user();
        $user->fill($request->validated())->save();

        return response()->json(UserResource::make($user->load('roles')));
    }

    /**
     * Change le mot de passe de l'utilisateur connecté et révoque tous ses
     * autres tokens (les autres appareils devront se reconnecter).
     */
    public function updatePassword(UpdatePasswordRequest $request): JsonResponse
    {
        $user = $request->user();
        $user->forceFill(['password' => Hash::make($request->validated('password'))])->save();

        // En test (Sanctum::actingAs) le token courant est transitoire, sans id.
        $current = $user->currentAccessToken();
        $currentTokenId = $current instanceof PersonalAccessToken ? $current->id : null;
        $user->tokens()->when($currentTokenId, fn ($q) => $q->whereKeyNot($currentTokenId))->delete();

        activity()->causedBy($user)->performedOn($user)->event('password_changed')->log('Mot de passe modifié');

        return response()->json(['message' => 'Mot de passe modifié.']);
    }
}
