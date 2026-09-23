<?php

use App\Http\Controllers\ActivityController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\BackupController;
use App\Http\Controllers\ChantierController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\InvitationController;
use App\Http\Controllers\ModuleController;
use App\Http\Controllers\PasswordResetController;
use App\Http\Controllers\PlanningController;
use App\Http\Controllers\ProfileController;
use App\Http\Controllers\RegistrationController;
use App\Http\Controllers\RoleController;
use App\Http\Controllers\SettingController;
use App\Http\Controllers\UploadController;
use App\Http\Controllers\UserController;
use App\Http\Controllers\WorkerController;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Routes API (préfixées par /api)
|--------------------------------------------------------------------------
|
| Les repères « make:crud » ci-dessous sont utilisés par la commande
| `php artisan make:crud` pour insérer automatiquement les routes d'une
| nouvelle entité. Ne les supprime pas.
|
*/

// Health check public — vérifie que l'API et la base répondent.
Route::get('/health', function () {
    try {
        DB::connection()->getPdo();
        $database = 'ok';
    } catch (Throwable) {
        $database = 'error';
    }

    return response()->json([
        'status' => $database === 'ok' ? 'ok' : 'degraded',
        'app' => config('app.name'),
        'database' => $database,
        'time' => now()->toIso8601String(),
    ], $database === 'ok' ? 200 : 503);
});

// Authentification (token Sanctum). Throttle anti-brute-force.
Route::post('/login', [AuthController::class, 'login'])->middleware('throttle:6,1');

// Mot de passe oublié / réinitialisation (throttle anti-abus).
Route::post('/forgot-password', [PasswordResetController::class, 'forgot'])->middleware('throttle:6,1');
Route::post('/reset-password', [PasswordResetController::class, 'reset'])->middleware('throttle:6,1');

// Inscription sur invitation : routes publiques protégées par un token à usage
// unique et expirable. Throttle contre l'énumération de tokens.
Route::middleware(['module:invitations', 'throttle:10,1'])->group(function () {
    Route::get('/register/{token}', [RegistrationController::class, 'show']);
    Route::post('/register/{token}', [RegistrationController::class, 'register']);
});

// Réglages publics (nom, logo, couleur, modules actifs) — lisibles avant connexion.
Route::get('/settings', [SettingController::class, 'index']);

// Routes protégées : nécessitent un token valide (Authorization: Bearer ...).
Route::middleware('auth:sanctum')->group(function () {
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::post('/logout-all', [AuthController::class, 'logoutAll']);
    Route::get('/user', [AuthController::class, 'me']);

    // Profil de l'utilisateur connecté.
    Route::put('/profile', [ProfileController::class, 'update']);
    Route::put('/profile/password', [ProfileController::class, 'updatePassword']);

    // Tableau de bord (contenu selon le rôle).
    Route::get('/dashboard', [DashboardController::class, 'index']);

    // Invitations (module) : admins toujours ; autres selon config/invitations.php.
    Route::middleware('module:invitations')->group(function () {
        Route::get('/invitations', [InvitationController::class, 'index']);
        Route::post('/invitations', [InvitationController::class, 'store'])->middleware('throttle:10,1');
        Route::delete('/invitations/{invitation}', [InvitationController::class, 'destroy']);
    });

    // Planning : lecture pour tous (un ouvrier ne voit que ses affectations),
    // écriture réservée aux planificateurs (config roles.planners : admin, chef).
    Route::get('/chantiers', [ChantierController::class, 'index']);
    Route::get('/chantiers/{chantier}', [ChantierController::class, 'show']);
    Route::get('/planning', [PlanningController::class, 'index']);
    Route::get('/planning/{affectation}', [PlanningController::class, 'show']);

    Route::middleware('role:'.implode('|', (array) config('roles.planners', ['admin'])))->group(function () {
        Route::apiResource('chantiers', ChantierController::class)->only(['store', 'update', 'destroy']);
        Route::get('/workers', [WorkerController::class, 'index']);
        Route::post('/planning', [PlanningController::class, 'store']);
        Route::post('/planning/copy-week', [PlanningController::class, 'copyWeek']);
        Route::put('/planning/{affectation}', [PlanningController::class, 'update']);
        Route::delete('/planning/{affectation}', [PlanningController::class, 'destroy']);
    });

    // make:crud (auth) — routes accessibles à tout utilisateur connecté.

    // Administration : réservé aux utilisateurs de rôle 'admin'.
    Route::middleware('admin')->group(function () {
        Route::apiResource('users', UserController::class);
        Route::post('/users/{user}/restore', [UserController::class, 'restore'])->withTrashed();
        Route::get('/roles', [RoleController::class, 'index']);

        Route::put('/settings', [SettingController::class, 'update']);
        Route::get('/modules', [ModuleController::class, 'index']);
        Route::put('/modules', [ModuleController::class, 'update']);
        Route::post('/uploads', [UploadController::class, 'store']);

        Route::get('/activity', [ActivityController::class, 'index']);

        Route::middleware('module:backups')->group(function () {
            Route::get('/backups', [BackupController::class, 'index']);
            Route::post('/backups', [BackupController::class, 'store']);
            Route::get('/backups/{name}/download', [BackupController::class, 'download']);
            Route::delete('/backups/{name}', [BackupController::class, 'destroy']);
        });

        // make:crud (admin) — routes réservées aux administrateurs.
    });
});
