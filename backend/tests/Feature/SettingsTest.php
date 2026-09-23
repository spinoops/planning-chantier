<?php

use App\Models\User;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Role;

it('expose les réglages en lecture publique', function () {
    $this->getJson('/api/settings')
        ->assertOk()
        ->assertJsonStructure(['app_name', 'app_logo_url', 'app_color']);
});

it('interdit la modification des réglages à un non-admin', function () {
    Role::findOrCreate('ouvrier');
    $user = User::factory()->create();
    $user->assignRole('ouvrier');
    Sanctum::actingAs($user);

    $this->putJson('/api/settings', [
        'app_name' => 'X',
        'app_logo_url' => '',
        'app_color' => '#000000',
    ])->assertForbidden();
});

it('permet à un admin de modifier les réglages', function () {
    Role::findOrCreate('admin');
    $admin = User::factory()->create();
    $admin->assignRole('admin');
    Sanctum::actingAs($admin);

    $this->putJson('/api/settings', [
        'app_name' => 'Ma Caisse',
        'app_logo_url' => '',
        'app_color' => '#0f766e',
    ])
        ->assertOk()
        ->assertJsonPath('app_name', 'Ma Caisse');

    $this->assertDatabaseHas('settings', ['key' => 'app_name', 'value' => 'Ma Caisse']);
});

it('valide la couleur des réglages (422)', function () {
    Role::findOrCreate('admin');
    $admin = User::factory()->create();
    $admin->assignRole('admin');
    Sanctum::actingAs($admin);

    $this->putJson('/api/settings', [
        'app_name' => 'X',
        'app_logo_url' => '',
        'app_color' => 'rouge',
    ])->assertStatus(422);
});
