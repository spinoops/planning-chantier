<?php

namespace App\Http\Controllers;

use App\Http\Resources\UserResource;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    /**
     * Authentifie l'utilisateur et renvoie un token Sanctum (Bearer).
     */
    public function login(Request $request): JsonResponse
    {
        $credentials = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
            'device_name' => ['sometimes', 'string', 'max:100'],
        ]);

        $user = User::where('email', $credentials['email'])->first();

        if (! $user || ! Hash::check($credentials['password'], $user->password)) {
            throw ValidationException::withMessages([
                'email' => [__('auth.failed')],
            ]);
        }

        $deviceName = $credentials['device_name'] ?? 'spa';
        $token = $user->createToken($deviceName)->plainTextToken;

        // Trace de connexion dans le journal d'activité (IP + appareil).
        activity()
            ->causedBy($user)
            ->performedOn($user)
            ->event('login')
            ->withProperties(['ip' => $request->ip(), 'device' => $deviceName])
            ->log('Connexion');

        return response()->json([
            'token' => $token,
            'user' => UserResource::make($user->load(['roles', 'equipe'])),
        ]);
    }

    /**
     * Révoque le token utilisé pour la requête courante.
     */
    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json(['message' => 'Déconnecté.']);
    }

    /**
     * Révoque tous les tokens de l'utilisateur (déconnexion de tous les appareils).
     */
    public function logoutAll(Request $request): JsonResponse
    {
        $request->user()->tokens()->delete();

        return response()->json(['message' => 'Déconnecté de tous les appareils.']);
    }

    /**
     * Renvoie l'utilisateur authentifié.
     */
    public function me(Request $request): JsonResponse
    {
        return response()->json(UserResource::make($request->user()->load(['roles', 'equipe'])));
    }
}
