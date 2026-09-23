<?php

namespace App\Http\Controllers;

use App\Services\BackupService;
use Illuminate\Http\JsonResponse;
use Symfony\Component\HttpFoundation\BinaryFileResponse;
use Throwable;

class BackupController extends Controller
{
    /** Liste des sauvegardes (admin). */
    public function index(BackupService $service): JsonResponse
    {
        return response()->json(['data' => $service->list()]);
    }

    /** Lance une sauvegarde maintenant (admin). */
    public function store(BackupService $service): JsonResponse
    {
        try {
            $name = $service->run();

            activity()->event('backup')->log('Sauvegarde créée : '.$name);

            return response()->json(['name' => $name, 'message' => 'Sauvegarde créée.'], 201);
        } catch (Throwable $e) {
            return response()->json(['message' => 'Sauvegarde impossible : '.$e->getMessage()], 422);
        }
    }

    /** Télécharge une sauvegarde (admin). */
    public function download(string $name, BackupService $service): BinaryFileResponse
    {
        $path = $service->pathFor($name);
        abort_if($path === null, 404, 'Sauvegarde introuvable.');

        return response()->download($path);
    }

    /** Supprime une sauvegarde (admin). */
    public function destroy(string $name, BackupService $service): JsonResponse
    {
        abort_unless($service->delete($name), 404, 'Sauvegarde introuvable.');

        return response()->json(['message' => 'Sauvegarde supprimée.']);
    }
}
