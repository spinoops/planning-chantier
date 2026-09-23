<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Spatie\Permission\Models\Role;

class RoleController extends Controller
{
    /**
     * Rôles disponibles avec leur libellé (config/roles.php), pour les
     * formulaires du front (utilisateurs, invitations).
     */
    public function index(): JsonResponse
    {
        $labels = (array) config('roles.labels', []);

        $roles = Role::query()
            ->orderBy('id')
            ->get()
            ->map(fn (Role $role) => [
                'name' => $role->name,
                'label' => $labels[$role->name] ?? ucfirst($role->name),
            ])
            ->values();

        return response()->json([
            'data' => $roles,
            'default' => config('roles.default', 'user'),
        ]);
    }
}
