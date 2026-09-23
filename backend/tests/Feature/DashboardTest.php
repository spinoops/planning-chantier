<?php

use App\Models\Invitation;
use App\Models\User;

it('renvoie les indicateurs du socle à un admin', function () {
    actingAsAdmin();
    User::factory()->count(2)->create();
    Invitation::factory()->create();

    $this->getJson('/api/dashboard')
        ->assertOk()
        ->assertJsonPath('is_admin', true)
        ->assertJsonPath('users.total', 4) // admin + 2 + inviteur de la factory
        ->assertJsonPath('users.admins', 1)
        ->assertJsonPath('invitations.pending', 1)
        ->assertJsonCount(6, 'signups')
        ->assertJsonStructure(['recent_activity', 'signups' => [['label', 'count']]]);
});

it('ne renvoie que l\'activité personnelle à un utilisateur simple', function () {
    actingAsUser();

    $this->getJson('/api/dashboard')
        ->assertOk()
        ->assertJsonPath('is_admin', false)
        ->assertJsonMissingPath('users')
        ->assertJsonStructure(['recent_activity']);
});

it('exige une authentification', function () {
    $this->getJson('/api/dashboard')->assertUnauthorized();
});
