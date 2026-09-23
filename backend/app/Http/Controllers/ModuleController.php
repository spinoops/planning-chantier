<?php

namespace App\Http\Controllers;

use App\Http\Requests\UpdateModulesRequest;
use App\Support\Modules;
use Illuminate\Http\JsonResponse;

class ModuleController extends Controller
{
    /**
     * Liste des modules avec leurs métadonnées et leur état (admin).
     */
    public function index(): JsonResponse
    {
        return response()->json(['data' => Modules::all()]);
    }

    /**
     * Active/désactive des modules (admin).
     */
    public function update(UpdateModulesRequest $request): JsonResponse
    {
        Modules::setMany($request->validated('modules'));

        return response()->json(['data' => Modules::all()]);
    }
}
