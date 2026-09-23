<?php

namespace App\Http\Controllers;

use App\Http\Requests\AcceptInvitationRequest;
use App\Http\Resources\UserResource;
use App\Models\Invitation;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

class RegistrationController extends Controller
{
    /**
     * Vérifie un lien d'invitation et renvoie de quoi afficher le formulaire.
     * Route publique : ne divulgue rien de plus que l'email invité.
     */
    public function show(string $token): JsonResponse
    {
        $invitation = $this->pendingInvitationOrFail($token);

        return response()->json([
            'email' => $invitation->email,
            'inviter_name' => $invitation->inviter->name,
            'expires_at' => $invitation->expires_at,
        ]);
    }

    /**
     * Crée le compte associé à l'invitation et connecte immédiatement
     * l'utilisateur en lui renvoyant un token Sanctum.
     */
    public function register(AcceptInvitationRequest $request, string $token): JsonResponse
    {
        $invitation = $this->pendingInvitationOrFail($token);
        $data = $request->validated();

        $user = DB::transaction(function () use ($invitation, $data) {
            // Verrou sur la ligne : deux requêtes simultanées avec le même
            // lien ne peuvent pas créer deux comptes.
            $locked = Invitation::whereKey($invitation->id)->lockForUpdate()->first();

            abort_if($locked === null || ! $locked->isPending(), 410, 'Ce lien d\'invitation n\'est plus valable.');

            $user = User::create([
                'name' => $data['name'],
                'email' => $locked->email,
                'password' => Hash::make($data['password']),
            ]);

            // Cliquer sur le lien reçu par email prouve la possession de
            // l'adresse : le compte est vérifié d'emblée.
            $user->forceFill(['email_verified_at' => now()])->save();
            $user->syncRoles([$locked->role]);

            $locked->forceFill([
                'accepted_at' => now(),
                'accepted_by' => $user->id,
            ])->save();

            return $user;
        });

        return response()->json([
            'token' => $user->createToken('spa')->plainTextToken,
            'user' => UserResource::make($user->load('roles')),
        ], 201);
    }

    /**
     * Retrouve une invitation utilisable, ou interrompt la requête.
     *
     * « Inconnu » (404) est distingué de « périmé » (410) : un token inexistant
     * ne doit rien révéler, un lien expiré mérite un message explicite.
     */
    private function pendingInvitationOrFail(string $token): Invitation
    {
        $invitation = Invitation::with('inviter')
            ->where('token_hash', Invitation::hashToken($token))
            ->first();

        abort_if($invitation === null, 404, 'Invitation introuvable.');
        abort_if($invitation->isAccepted(), 410, 'Cette invitation a déjà été utilisée.');
        abort_if($invitation->isExpired(), 410, 'Cette invitation a expiré.');

        return $invitation;
    }
}
