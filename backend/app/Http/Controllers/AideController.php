<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

/**
 * Mode d'emploi intégré (page /aide du front). Le texte (resources/aide/aide.json) et les
 * captures (resources/aide/img) ne sont pas dans public/ : ils ne sont servis qu'aux
 * personnes connectées (routes sous auth:sanctum). Édition du mode d'emploi = ces fichiers.
 */
class AideController extends Controller
{
    /** Blocs du mode d'emploi (h1, h2, p, li, ol, tip, img). */
    public function index(): JsonResponse
    {
        $path = resource_path('aide/aide.json');
        abort_unless(is_file($path), 404);

        return response()->json(['data' => json_decode((string) file_get_contents($path), true)]);
    }

    /** Une capture d'écran du mode d'emploi. */
    public function image(string $name): BinaryFileResponse
    {
        abort_unless(preg_match('/^[a-z0-9-]+\.webp$/', $name) === 1, 404);
        $path = resource_path('aide/img/'.$name);
        abort_unless(is_file($path), 404);

        return response()->file($path, [
            'Content-Type' => 'image/webp',
            'Cache-Control' => 'private, max-age=86400',
        ]);
    }
}
