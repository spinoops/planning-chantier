<?php

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

/*
|--------------------------------------------------------------------------
| Test Case
|--------------------------------------------------------------------------
|
| Les tests Feature utilisent une base SQLite en mémoire (phpunit.xml),
| réinitialisée à chaque test : ils ne touchent jamais la base MySQL.
|
*/

pest()->extend(TestCase::class)
    ->use(RefreshDatabase::class)
    ->in('Feature');

/*
|--------------------------------------------------------------------------
| Helpers partagés
|--------------------------------------------------------------------------
|
| Disponibles dans tous les fichiers de test. Ils créent les rôles de base
| et connectent un utilisateur (token Sanctum simulé).
|
*/

/**
 * Crée les rôles de base (config/roles.php) s'ils n'existent pas.
 */
function ensureRoles(): void
{
    foreach (array_keys((array) config('roles.labels', ['admin' => '', 'ouvrier' => ''])) as $role) {
        Role::findOrCreate($role);
    }
}

/**
 * Connecte un utilisateur fraîchement créé avec le rôle demandé.
 *
 * @param  array<string, mixed>  $attributes
 */
function actingAsRole(string $role, array $attributes = []): User
{
    ensureRoles();
    $user = User::factory()->create($attributes);
    $user->assignRole($role);
    Sanctum::actingAs($user);

    return $user;
}

/**
 * Connecte un administrateur.
 *
 * @param  array<string, mixed>  $attributes
 */
function actingAsAdmin(array $attributes = []): User
{
    return actingAsRole('admin', $attributes);
}

/**
 * Connecte un utilisateur simple (rôle par défaut : ouvrier).
 *
 * @param  array<string, mixed>  $attributes
 */
function actingAsUser(array $attributes = []): User
{
    return actingAsRole((string) config('roles.default', 'ouvrier'), $attributes);
}
