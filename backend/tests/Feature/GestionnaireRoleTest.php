<?php

use App\Models\Chantier;
use App\Models\User;
use Spatie\Permission\Models\Role;

beforeEach(fn () => ensureRoles());

it('expose le rôle gestionnaire avec sa description', function () {
    actingAsAdmin();

    $response = $this->getJson('/api/roles')->assertOk();
    $names = collect($response->json('data'))->pluck('name')->all();

    expect($names)->toContain('gestionnaire')
        ->and(collect($response->json('data'))->firstWhere('name', 'gestionnaire')['description'])->not->toBeEmpty();
});

it('laisse un gestionnaire préparer un chantier et planifier', function () {
    $gestionnaire = actingAsRole('gestionnaire');
    $ouvrier = User::factory()->create();
    $ouvrier->assignRole('ouvrier');

    $chantier = $this->postJson('/api/chantiers', [
        'name' => 'Villa Dupont', 'client' => 'Dupont', 'color' => '#e30917', 'status' => 'planned',
    ])->assertCreated()->json('data');

    $this->postJson('/api/planning', [
        'chantier_id' => $chantier['id'], 'date' => now()->toDateString(), 'worker_ids' => [$ouvrier->id],
    ])->assertCreated();

    expect($gestionnaire->isPlanner())->toBeTrue()
        ->and(User::assignable()->pluck('id'))->toContain($gestionnaire->id);
});

it('refuse à un gestionnaire la gestion des comptes', function () {
    actingAsRole('gestionnaire');

    $this->getJson('/api/users')->assertForbidden();
});

it('permet à un administrateur de cumuler plusieurs rôles sur un compte', function () {
    actingAsAdmin();
    $user = User::factory()->create();
    $user->assignRole('ouvrier');

    $this->putJson("/api/users/{$user->id}", [
        'name' => $user->name, 'email' => $user->email, 'roles' => ['chef', 'admin'],
    ])->assertOk()->assertJsonCount(2, 'data.roles');

    expect($user->fresh()->getRoleNames()->sort()->values()->all())->toBe(['admin', 'chef']);
});

it('ne garde que les rôles existants', function () {
    actingAsAdmin();
    $user = User::factory()->create();

    $this->putJson("/api/users/{$user->id}", [
        'name' => $user->name, 'email' => $user->email, 'roles' => ['directeur'],
    ])->assertUnprocessable()->assertJsonValidationErrors(['roles.0']);

    expect(Role::query()->where('name', 'directeur')->exists())->toBeFalse()
        ->and(Chantier::query()->count())->toBe(0);
});
