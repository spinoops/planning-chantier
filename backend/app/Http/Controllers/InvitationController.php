<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreInvitationRequest;
use App\Http\Resources\InvitationResource;
use App\Models\Invitation;
use App\Notifications\InvitationNotification;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Notification;

class InvitationController extends Controller
{
    /**
     * Invitations émises : les siennes, ou toutes pour un administrateur.
     */
    public function index(Request $request): AnonymousResourceCollection
    {
        $invitations = Invitation::with('inviter')
            ->unless($request->user()->isAdmin(), function ($query) use ($request) {
                $query->where('invited_by', $request->user()->id);
            })
            ->orderByDesc('id')
            ->paginate(15)
            ->withQueryString();

        return InvitationResource::collection($invitations);
    }

    /**
     * Crée une invitation et envoie le lien par email.
     *
     * Le token en clair n'est renvoyé qu'ici (dans `accept_url`), pour que
     * l'inviteur puisse aussi transmettre le lien par ses propres moyens.
     */
    public function store(StoreInvitationRequest $request): JsonResponse
    {
        $data = $request->validated();
        $plainToken = Invitation::generateToken();

        $invitation = Invitation::create([
            'email' => $data['email'],
            'token_hash' => Invitation::hashToken($plainToken),
            'role' => $data['role'] ?? config('roles.default', 'user'),
            'invited_by' => $request->user()->id,
            'expires_at' => now()->addDays((int) config('invitations.expires_days')),
        ]);

        $notification = new InvitationNotification($invitation->load('inviter'), $plainToken);
        Notification::route('mail', $invitation->email)->notify($notification);

        activity()->causedBy($request->user())->performedOn($invitation)->event('invited')
            ->withProperties(['email' => $invitation->email, 'role' => $invitation->role])
            ->log('Invitation envoyée');

        return InvitationResource::make($invitation)
            ->additional(['accept_url' => $notification->acceptUrl()])
            ->response()
            ->setStatusCode(201);
    }

    /**
     * Révoque une invitation encore en attente.
     */
    public function destroy(Invitation $invitation): JsonResponse
    {
        Gate::authorize('delete', $invitation);

        if ($invitation->isAccepted()) {
            return response()->json(['message' => 'Cette invitation a déjà été acceptée.'], 422);
        }

        $invitation->delete();

        return response()->json(['message' => 'Invitation révoquée.']);
    }
}
