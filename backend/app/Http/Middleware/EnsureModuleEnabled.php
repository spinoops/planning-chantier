<?php

namespace App\Http\Middleware;

use App\Support\Modules;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureModuleEnabled
{
    /**
     * Bloque les routes d'un module désactivé (alias `module:<clé>`).
     * Renvoie un 404 JSON : pour le client, la fonction n'existe pas.
     */
    public function handle(Request $request, Closure $next, string $module): Response
    {
        if (! Modules::isEnabled($module)) {
            return response()->json(['message' => 'Ce module est désactivé.'], 404);
        }

        return $next($request);
    }
}
