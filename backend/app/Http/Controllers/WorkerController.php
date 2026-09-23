<?php

namespace App\Http\Controllers;

use App\Http\Resources\WorkerResource;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class WorkerController extends Controller
{
    /**
     * Membres de l'équipe affectables sur un chantier (rôles config roles.assignable),
     * triés par nom. Liste complète (non paginée) : elle alimente les sélecteurs
     * du planning. ?search= filtre sur nom / email / métier.
     */
    public function index(Request $request): AnonymousResourceCollection
    {
        $filters = $request->validate([
            'search' => ['nullable', 'string', 'max:100'],
        ]);

        $workers = User::query()
            ->with('roles')
            ->assignable()
            ->search($filters['search'] ?? null)
            ->orderBy('name')
            ->get();

        return WorkerResource::collection($workers);
    }
}
