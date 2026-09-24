<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreUserRequest;
use App\Http\Requests\UpdateUserRequest;
use App\Http\Resources\UserResource;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;

class UserController extends Controller
{
    /**
     * Liste paginée des utilisateurs.
     *
     * Filtres : ?search= (nom/email), ?role=admin, ?trashed=1 (corbeille),
     * ?sort=name|email|created_at, ?dir=asc|desc, ?per_page=15.
     */
    public function index(Request $request): AnonymousResourceCollection
    {
        $filters = $request->validate([
            'search' => ['nullable', 'string', 'max:100'],
            'role' => ['nullable', 'string', Rule::exists('roles', 'name')],
            'trashed' => ['nullable', 'boolean'],
            'sort' => ['nullable', Rule::in(['name', 'email', 'created_at'])],
            'dir' => ['nullable', Rule::in(['asc', 'desc'])],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $users = User::with(['roles', 'equipe'])
            ->search($filters['search'] ?? null)
            ->when($filters['role'] ?? null, fn ($q, $role) => $q->role($role))
            ->when($filters['trashed'] ?? false, fn ($q) => $q->onlyTrashed())
            ->orderBy($filters['sort'] ?? 'created_at', $filters['dir'] ?? 'desc')
            ->orderByDesc('id')
            ->paginate((int) ($filters['per_page'] ?? 15))
            ->withQueryString();

        return UserResource::collection($users);
    }

    /**
     * Détail d'un utilisateur.
     */
    public function show(User $user): UserResource
    {
        return UserResource::make($user->load(['roles', 'equipe']));
    }

    /**
     * Crée un utilisateur et lui assigne ses rôles.
     */
    public function store(StoreUserRequest $request): JsonResponse
    {
        $data = $request->validated();

        $user = User::create([
            'name' => $data['name'],
            'email' => $data['email'],
            'password' => Hash::make($data['password']),
            'phone' => $data['phone'] ?? null,
            'job_title' => $data['job_title'] ?? null,
            'color' => $data['color'] ?? null,
            'equipe_id' => $data['equipe_id'] ?? null,
        ]);
        $user->syncRoles($data['roles']);

        return UserResource::make($user->load(['roles', 'equipe']))
            ->response()
            ->setStatusCode(201);
    }

    /**
     * Met à jour un utilisateur. Le mot de passe est optionnel.
     */
    public function update(UpdateUserRequest $request, User $user): UserResource|JsonResponse
    {
        $data = $request->validated();

        // Un admin ne peut pas se retirer lui-même le rôle admin (verrouillage).
        if ($request->user()->is($user) && ! in_array('admin', $data['roles'], true)) {
            return response()->json(['message' => 'Vous ne pouvez pas retirer votre propre rôle administrateur.'], 422);
        }

        $user->name = $data['name'];
        $user->email = $data['email'];
        $user->phone = $data['phone'] ?? null;
        $user->job_title = $data['job_title'] ?? null;
        $user->color = $data['color'] ?? null;
        $user->equipe_id = $data['equipe_id'] ?? null;
        if (! empty($data['password'])) {
            $user->password = Hash::make($data['password']);
            // Nouveau mot de passe imposé : les sessions existantes sont révoquées.
            $user->tokens()->delete();
        }
        $user->save();
        $user->syncRoles($data['roles']);

        return UserResource::make($user->load(['roles', 'equipe']));
    }

    /**
     * Supprime un utilisateur (soft delete ; interdit sur son propre compte).
     */
    public function destroy(Request $request, User $user): JsonResponse
    {
        if ($request->user()->is($user)) {
            return response()->json(['message' => 'Vous ne pouvez pas supprimer votre propre compte.'], 422);
        }

        // Ses tokens sont révoqués : un compte supprimé ne doit plus pouvoir appeler l'API.
        $user->tokens()->delete();
        $user->delete();

        return response()->json(['message' => 'Utilisateur supprimé.']);
    }

    /**
     * Restaure un utilisateur supprimé (route déclarée avec ->withTrashed()).
     */
    public function restore(User $user): UserResource|JsonResponse
    {
        if (! $user->trashed()) {
            return response()->json(['message' => 'Cet utilisateur n\'est pas supprimé.'], 422);
        }

        $user->restore();

        return UserResource::make($user->load(['roles', 'equipe']));
    }
}
