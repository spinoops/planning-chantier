<?php

use Illuminate\Support\Facades\Route;

// Interface React servie depuis le même domaine que l'API : le build Vite (frontend/dist)
// est copié dans public/ ; toute URL hors /api renvoie son index.html (routage côté client,
// les fichiers existants — assets, icônes, service worker, /storage — sont servis directement
// par Apache). Sans build (dev : le front tourne sur Vite), la page d'accueil Laravel reste affichée.
Route::get('/{any?}', function () {
    $spa = public_path('index.html');

    return is_file($spa)
        ? response()->file($spa, ['Cache-Control' => 'no-cache, no-store, must-revalidate'])
        : view('welcome');
})->where('any', '^(?!api(?:/|$)).*');
