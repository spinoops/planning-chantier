<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

/**
 * Rôles de l'application (config/roles.php : admin, gestionnaire, chef, ouvrier).
 * Idempotent : exécuté à chaque déploiement, sans risque pour les données.
 */
class RolesSeeder extends Seeder
{
    public function run(): void
    {
        app(PermissionRegistrar::class)->forgetCachedPermissions();
        foreach (array_keys((array) config('roles.labels', [])) as $role) {
            Role::findOrCreate($role, 'web');
        }
    }
}
