<?php

use App\Models\User;

it('interdit le journal d\'activité à un non-admin', function () {
    actingAsUser();

    $this->getJson('/api/activity')->assertForbidden();
});

it('liste le journal d\'activité paginé, du plus récent au plus ancien', function () {
    actingAsAdmin();
    $created = User::factory()->create(['name' => 'Journalisé']);
    $created->update(['name' => 'Renommé']);

    $response = $this->getJson('/api/activity')
        ->assertOk()
        ->assertJsonStructure([
            'data' => [['id', 'description', 'event', 'subject_type', 'subject_id', 'subject_label', 'causer', 'properties', 'created_at']],
            'meta',
        ]);

    expect($response->json('data.0.event'))->toBe('updated')
        ->and($response->json('data.0.subject_type'))->toBe('User')
        ->and($response->json('data.0.subject_label'))->toBe('Renommé');
});

it('filtre le journal par événement et type de sujet', function () {
    actingAsAdmin();
    User::factory()->create();

    $this->getJson('/api/activity?event=created&subject_type=User')
        ->assertOk()
        ->assertJsonMissing(['event' => 'updated']);

    $this->getJson('/api/activity?event=inexistant')
        ->assertOk()
        ->assertJsonCount(0, 'data');
});

it('journalise les connexions avec l\'adresse IP', function () {
    $user = User::factory()->create(['password' => bcrypt('secret123')]);

    $this->postJson('/api/login', ['email' => $user->email, 'password' => 'secret123'])->assertOk();

    $this->assertDatabaseHas('activity_log', [
        'causer_id' => $user->id,
        'event' => 'login',
    ]);
});
