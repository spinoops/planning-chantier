<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Artisan;
use Throwable;

/**
 * GET /api/cron/run/{token} — appelé par le planificateur de tâches d'Infomaniak
 * (qui appelle une URL). Lance planning:cron (rappels push, sauvegarde, ménage).
 *
 * Le jeton doit correspondre à CRON_TOKEN (.env) ; sinon 404, comme si l'adresse
 * n'existait pas. Sans CRON_TOKEN, l'adresse est désactivée.
 */
class CronController extends Controller
{
    public function __invoke(string $token): JsonResponse
    {
        $expected = (string) config('planning.cron_token');
        if ($expected === '' || ! hash_equals($expected, $token)) {
            abort(404);
        }

        @set_time_limit(600);
        try {
            $status = Artisan::call('planning:cron');
        } catch (Throwable $e) {
            report($e);

            // Cause lisible dans le journal du planificateur, pas un 500 muet.
            return response()->json([
                'status' => 'error',
                'error' => class_basename($e).' : '.$e->getMessage(),
                'output' => trim(Artisan::output()),
            ], 500);
        }

        return response()->json([
            'status' => $status === 0 ? 'ok' : 'error',
            'output' => trim(Artisan::output()),
        ], $status === 0 ? 200 : 500);
    }
}
