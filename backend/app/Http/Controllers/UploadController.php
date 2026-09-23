<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class UploadController extends Controller
{
    /**
     * Téléverse une image (logo, illustration…) sur le disque public et renvoie
     * son URL absolue. Réservé aux admins (middleware). Nécessite le lien
     * symbolique `php artisan storage:link` (public/storage → storage/app/public).
     */
    public function store(Request $request): JsonResponse
    {
        $request->validate([
            'file' => ['required', 'file', 'image', 'mimes:png,jpg,jpeg,webp,svg', 'max:4096'],
        ]);

        $path = $request->file('file')->store('uploads', 'public');

        // URL absolue : le front est servi depuis une autre origine que l'API.
        return response()->json(['url' => url(Storage::disk('public')->url($path))], 201);
    }
}
