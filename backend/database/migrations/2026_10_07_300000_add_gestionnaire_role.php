<?php

use Illuminate\Database\Migrations\Migration;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

/**
 * Rôle « gestionnaire » (employé de bureau : préparation des chantiers, planning, heures).
 * Les rôles sont des lignes de la table `roles` (spatie) : on crée celle-ci de façon idempotente.
 */
return new class extends Migration
{
    public function up(): void
    {
        app(PermissionRegistrar::class)->forgetCachedPermissions();
        Role::findOrCreate('gestionnaire', 'web');
    }

    public function down(): void
    {
        Role::query()->where('name', 'gestionnaire')->delete();
        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }
};
