<?php

use App\Models\Affectation;
use App\Models\Chantier;
use App\Models\Client;
use App\Models\SousTraitant;
use App\Models\TimeEntry;
use App\Models\User;

function employe(string $name = 'Employé'): User
{
    ensureRoles();
    $u = User::factory()->create(['name' => $name]);
    $u->assignRole('ouvrier');

    return $u;
}

it('crée un client et un sous-traitant puis un chantier complet de préparation', function () {
    actingAsRole('chef');

    $clientId = $this->postJson('/api/clients', ['name' => 'Famille Roulet', 'phone' => '+41 79 000 00 00', 'city' => 'Lausanne'])
        ->assertCreated()
        ->json('data.id');
    $stId = $this->postJson('/api/sous-traitants', ['name' => 'Électro Jura', 'trade' => 'Électricien'])
        ->assertCreated()
        ->json('data.id');

    $chantier = $this->postJson('/api/chantiers', [
        'name' => 'Villa Roulet',
        'client_id' => $clientId,
        'address' => 'Chemin des Cèdres 12',
        'city' => 'Lausanne',
        'color' => '#2563eb',
        'status' => 'planned',
        'estimated_hours' => 120.5,
        'mesures' => 'Dalle 8.40 × 6.20 m',
        'materiel' => [['label' => 'Béton', 'qty' => '6 m³'], ['label' => 'Treillis', 'done' => true]],
        'sous_traitants' => [['id' => $stId, 'note' => 'Après la dalle', 'planned_date' => '2026-11-02']],
        'quote_status' => 'to_prepare',
        'remeasure_needed' => true,
        'notes' => 'Accès par le chemin du haut.',
    ])
        ->assertCreated()
        ->assertJsonPath('data.client_record.name', 'Famille Roulet')
        ->assertJsonPath('data.estimated_hours', 120.5)
        ->assertJsonPath('data.materiel.0.label', 'Béton')
        ->assertJsonPath('data.materiel.1.done', true)
        ->assertJsonPath('data.sous_traitants.0.id', $stId)
        ->assertJsonPath('data.sous_traitants.0.note', 'Après la dalle')
        ->assertJsonPath('data.quote_status_label', 'À établir')
        ->json('data');

    // Étapes dérivées : création faite, devis à établir, mesures à reprendre, pas d'estimation planning.
    $steps = collect($chantier['steps'])->keyBy('key');
    expect($steps['creation']['state'])->toBe('done')
        ->and($steps['devis']['state'])->toBe('todo')
        ->and($steps['mesures']['state'])->toBe('todo')
        ->and($steps['estimation']['state'])->toBe('todo')
        ->and($steps['planning']['state'])->toBe('todo');

    // Devis accepté, mesures reprises, estimation planning posée.
    $updated = $this->putJson("/api/chantiers/{$chantier['id']}", [
        'name' => 'Villa Roulet',
        'color' => '#2563eb',
        'status' => 'planned',
        'quote_status' => 'accepted',
        'quote_amount' => 18500,
        'quote_accepted_at' => '2026-10-01',
        'remeasure_needed' => true,
        'remeasured_at' => '2026-10-03',
        'planning_hours' => 110,
        'sous_traitants' => [],
    ])
        ->assertOk()
        ->assertJsonCount(0, 'data.sous_traitants')
        ->json('data');
    $steps = collect($updated['steps'])->keyBy('key');
    expect($steps['devis']['state'])->toBe('done')
        ->and($steps['mesures']['state'])->toBe('done')
        ->and($steps['estimation']['state'])->toBe('done');

    // Un ouvrier lit la fiche (vue employé) mais ne la modifie pas.
    actingAsRole('ouvrier');
    $this->getJson("/api/chantiers/{$chantier['id']}")->assertOk()->assertJsonPath('data.mesures', 'Dalle 8.40 × 6.20 m');
    $this->getJson('/api/clients')->assertOk();
    $this->postJson('/api/clients', ['name' => 'X'])->assertForbidden();
});

it('valide la fiche chantier (client inconnu, matériel sans libellé)', function () {
    actingAsAdmin();

    $this->postJson('/api/chantiers', ['name' => 'X', 'color' => '#000000', 'status' => 'active', 'client_id' => 999, 'materiel' => [['qty' => '2']], 'quote_status' => 'bizarre'])
        ->assertStatus(422)
        ->assertJsonValidationErrors(['client_id', 'materiel.0.label', 'quote_status']);
});

it('fournit le récapitulatif pour la facturation et son export CSV', function () {
    actingAsRole('chef');
    $client = Client::create(['name' => 'Régie Lémanique']);
    $chantier = Chantier::factory()->create(['name' => 'Immeuble Lac', 'client_id' => $client->id, 'estimated_hours' => 100, 'planning_hours' => 90]);
    $alice = employe('Alice');
    $bob = employe('Bob');

    $a1 = Affectation::factory()->create(['chantier_id' => $chantier->id, 'date' => '2026-10-05', 'start_time' => '08:00', 'end_time' => '12:00']);
    $a1->syncPeople([$alice->id, $bob->id]);
    TimeEntry::create(['user_id' => $alice->id, 'affectation_id' => $a1->id, 'chantier_id' => $chantier->id, 'date' => '2026-10-05', 'start_time' => '08:00', 'end_time' => '12:30', 'break_minutes' => 30, 'status' => 'validated']);
    TimeEntry::create(['user_id' => $bob->id, 'affectation_id' => $a1->id, 'chantier_id' => $chantier->id, 'date' => '2026-10-05', 'start_time' => '08:00', 'end_time' => '12:00', 'status' => 'submitted']);
    // Hors période : ignoré avec ?from&to.
    TimeEntry::create(['user_id' => $bob->id, 'chantier_id' => $chantier->id, 'date' => '2026-11-20', 'start_time' => '08:00', 'end_time' => '09:00', 'status' => 'draft']);

    $recap = $this->getJson("/api/chantiers/{$chantier->id}/recap")->assertOk()->json();
    expect($recap['totals']['worked_minutes'])->toBe(540)
        ->and($recap['totals']['validated_minutes'])->toBe(240)
        ->and($recap['totals']['planned_minutes'])->toBe(480) // 4 h × 2 personnes
        ->and($recap['totals']['estimated_minutes'])->toBe(6000)
        ->and($recap['totals']['days'])->toBe(1)
        ->and(collect($recap['by_user'])->firstWhere('user.id', $alice->id)['validated_minutes'])->toBe(240)
        ->and($recap['chantier']['client_record']['name'])->toBe('Régie Lémanique');

    $filtered = $this->getJson("/api/chantiers/{$chantier->id}/recap?from=2026-10-01&to=2026-10-31")->assertOk()->json();
    expect($filtered['totals']['worked_minutes'])->toBe(480)->and($filtered['totals']['entries'])->toBe(2);

    $csv = $this->get("/api/chantiers/{$chantier->id}/recap.csv")->assertOk()->assertHeader('content-type', 'text/csv; charset=UTF-8')->streamedContent();
    expect($csv)->toContain('Immeuble Lac')->toContain('Client;"Régie Lémanique"')->toContain('Alice;4.00')->toContain('"Heures planifiées";8.00');

    // Un ouvrier n'a pas accès au récapitulatif.
    actingAsRole('ouvrier');
    $this->getJson("/api/chantiers/{$chantier->id}/recap")->assertForbidden();
});

it('liste les chantiers d\'un client et compte ses chantiers', function () {
    actingAsRole('chef');
    $client = Client::create(['name' => 'Commune de Pully']);
    Chantier::factory()->count(2)->create(['client_id' => $client->id]);
    Chantier::factory()->create();

    $this->getJson("/api/chantiers?client_id={$client->id}")->assertOk()->assertJsonCount(2, 'data');
    $this->getJson('/api/clients?search=pully')->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.chantiers_count', 2);

    $st = SousTraitant::create(['name' => 'Sanitaire Plus', 'trade' => 'Sanitaire']);
    $this->getJson('/api/sous-traitants?search=sanit')->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $st->id);
});
