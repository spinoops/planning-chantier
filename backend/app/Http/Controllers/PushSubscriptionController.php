<?php

namespace App\Http\Controllers;

use App\Notifications\TestPushNotification;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Abonnements aux notifications push (Web Push) de l'utilisateur connecté :
 * un abonnement par appareil / navigateur, identifié par son `endpoint`.
 */
class PushSubscriptionController extends Controller
{
    /** Clé publique VAPID, nécessaire au navigateur pour s'abonner. */
    public function publicKey(): JsonResponse
    {
        return response()->json(['public_key' => (string) config('webpush.vapid.public_key')]);
    }

    /** Enregistre (ou met à jour) l'abonnement de cet appareil. */
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'endpoint' => ['required', 'string', 'max:2048'],
            'keys.p256dh' => ['required', 'string', 'max:255'],
            'keys.auth' => ['required', 'string', 'max:255'],
            'content_encoding' => ['nullable', 'string', 'max:20'],
        ]);

        $user = $request->user();
        $user->updatePushSubscription($data['endpoint'], $data['keys']['p256dh'], $data['keys']['auth'], $data['content_encoding'] ?? 'aesgcm');

        return response()->json([
            'message' => 'Notifications activées sur cet appareil.',
            'count' => $user->pushSubscriptions()->count(),
        ], 201);
    }

    /** Retire l'abonnement de cet appareil. */
    public function destroy(Request $request): JsonResponse
    {
        $data = $request->validate(['endpoint' => ['required', 'string', 'max:2048']]);
        $user = $request->user();
        $user->deletePushSubscription($data['endpoint']);

        return response()->json([
            'message' => 'Notifications désactivées sur cet appareil.',
            'count' => $user->pushSubscriptions()->count(),
        ]);
    }

    /** Envoie une notification de test à tous les appareils de l'utilisateur. */
    public function test(Request $request): JsonResponse
    {
        $user = $request->user();
        if (! $user->pushSubscriptions()->exists()) {
            return response()->json(['message' => 'Aucun appareil abonné : active d\'abord les alertes sur ce téléphone.'], 422);
        }

        $user->notify(new TestPushNotification);

        return response()->json(['message' => 'Notification de test envoyée.']);
    }
}
