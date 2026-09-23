<?php

use App\Models\Chantier;

it('permet à un ouvrier de lister les chantiers mais pas d\'en créer', function () {
    actingAsRole('ouvrier');
    Chantier::factory()->count(2)->create();

    $this->getJson('/api/chantiers')
        ->assertOk()
        ->assertJsonCount(2, 'data')
        ->assertJsonStructure(['data' => [['id', 'name', 'color', 'status', 'status_label']], 'meta']);

    $this->postJson('/api/chantiers', ['name' => 'Interdit', 'color' => '#000000', 'status' => 'active'])
        ->assertForbidden();
});

it('permet à un chef de chantier de créer, modifier et supprimer un chantier', function () {
    actingAsRole('chef');

    $id = $this->postJson('/api/chantiers', [
        'name' => 'Villa Test',
        'client' => 'M. Test',
        'address' => 'Rue du Test 1',
        'city' => 'Lausanne',
        'color' => '#2563eb',
        'status' => 'planned',
        'start_date' => '2026-10-01',
        'end_date' => '2026-12-15',
    ])
        ->assertCreated()
        ->assertJsonPath('data.name', 'Villa Test')
        ->assertJsonPath('data.status_label', 'À venir')
        ->json('data.id');

    $this->putJson("/api/chantiers/{$id}", [
        'name' => 'Villa Test 2',
        'color' => '#16a34a',
        'status' => 'active',
    ])
        ->assertOk()
        ->assertJsonPath('data.name', 'Villa Test 2')
        ->assertJsonPath('data.status', 'active');

    $this->deleteJson("/api/chantiers/{$id}")->assertOk();
    $this->assertSoftDeleted('chantiers', ['id' => $id]);

    $this->getJson('/api/chantiers')->assertOk()->assertJsonCount(0, 'data');
});

it('valide les données d\'un chantier (422)', function () {
    actingAsAdmin();

    $this->postJson('/api/chantiers', [
        'name' => '',
        'color' => 'bleu',
        'status' => 'inconnu',
        'start_date' => '2026-10-10',
        'end_date' => '2026-10-01',
    ])
        ->assertStatus(422)
        ->assertJsonValidationErrors(['name', 'color', 'status', 'end_date']);
});

it('filtre les chantiers par recherche, statut et ouverture', function () {
    actingAsAdmin();
    Chantier::factory()->create(['name' => 'Immeuble Lac', 'city' => 'Vevey', 'status' => 'active']);
    Chantier::factory()->create(['name' => 'Villa Alpes', 'city' => 'Sion', 'status' => 'done']);
    Chantier::factory()->create(['name' => 'Halle', 'city' => 'Crissier', 'status' => 'paused']);

    $this->getJson('/api/chantiers?search=vevey')->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.name', 'Immeuble Lac');
    $this->getJson('/api/chantiers?status=done')->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.name', 'Villa Alpes');
    $this->getJson('/api/chantiers?open=1')->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.name', 'Immeuble Lac');
});
