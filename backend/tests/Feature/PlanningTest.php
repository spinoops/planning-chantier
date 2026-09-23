<?php

use App\Models\Affectation;
use App\Models\Chantier;
use App\Models\User;

function makeWorker(string $name = 'Ouvrier'): User
{
    ensureRoles();
    $worker = User::factory()->create(['name' => $name]);
    $worker->assignRole('ouvrier');

    return $worker;
}

it('permet à un chef de créer une affectation avec des ouvriers', function () {
    actingAsRole('chef');
    $chantier = Chantier::factory()->create();
    $a = makeWorker('Alice');
    $b = makeWorker('Bob');

    $this->postJson('/api/planning', [
        'chantier_id' => $chantier->id,
        'date' => '2026-09-28',
        'start_time' => '07:00',
        'end_time' => '16:30',
        'note' => 'Coulage dalle',
        'worker_ids' => [$a->id, $b->id],
    ])
        ->assertCreated()
        ->assertJsonPath('data.date', '2026-09-28')
        ->assertJsonPath('data.start_time', '07:00')
        ->assertJsonPath('data.chantier.id', $chantier->id)
        ->assertJsonCount(2, 'data.workers')
        ->assertJsonPath('data.workers.0.name', 'Alice');

    $this->assertDatabaseCount('affectation_user', 2);
});

it('valide une affectation (chantier requis, heures cohérentes)', function () {
    actingAsAdmin();

    $this->postJson('/api/planning', [
        'date' => '2026-09-28',
        'start_time' => '16:00',
        'end_time' => '08:00',
        'worker_ids' => [],
    ])
        ->assertStatus(422)
        ->assertJsonValidationErrors(['chantier_id', 'end_time']);
});

it('liste les affectations d\'une période avec chantier et équipe', function () {
    actingAsRole('chef');
    $chantier = Chantier::factory()->create();
    $worker = makeWorker();
    $inside = Affectation::factory()->create(['chantier_id' => $chantier->id, 'date' => '2026-09-29']);
    $inside->workers()->sync([$worker->id]);
    Affectation::factory()->create(['chantier_id' => $chantier->id, 'date' => '2026-10-15']);

    $this->getJson('/api/planning?from=2026-09-28&to=2026-10-04')
        ->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.id', $inside->id)
        ->assertJsonPath('data.0.chantier.name', $chantier->name)
        ->assertJsonPath('data.0.workers.0.id', $worker->id)
        ->assertJsonPath('meta.from', '2026-09-28');
});

it('refuse une période de plus de 100 jours (422)', function () {
    actingAsAdmin();

    $this->getJson('/api/planning?from=2026-01-01&to=2026-12-31')->assertStatus(422);
});

it('ne montre à un ouvrier que ses propres affectations', function () {
    $me = actingAsRole('ouvrier');
    $other = makeWorker('Autre');
    $chantier = Chantier::factory()->create();

    $mine = Affectation::factory()->create(['chantier_id' => $chantier->id, 'date' => '2026-09-29']);
    $mine->workers()->sync([$me->id, $other->id]);
    $notMine = Affectation::factory()->create(['chantier_id' => $chantier->id, 'date' => '2026-09-29']);
    $notMine->workers()->sync([$other->id]);

    $this->getJson('/api/planning?from=2026-09-28&to=2026-10-04')
        ->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.id', $mine->id);

    $this->getJson("/api/planning/{$notMine->id}")->assertForbidden();
    $this->getJson("/api/planning/{$mine->id}")->assertOk();

    // Un ouvrier ne modifie rien.
    $this->putJson("/api/planning/{$mine->id}", ['date' => '2026-09-30'])->assertForbidden();
    $this->deleteJson("/api/planning/{$mine->id}")->assertForbidden();
    $this->getJson('/api/workers')->assertForbidden();
});

it('déplace une affectation (changement de date seul) et remplace son équipe', function () {
    actingAsRole('chef');
    $chantier = Chantier::factory()->create();
    $a = makeWorker('Alice');
    $b = makeWorker('Bob');
    $affectation = Affectation::factory()->create(['chantier_id' => $chantier->id, 'date' => '2026-09-29']);
    $affectation->workers()->sync([$a->id]);

    $this->putJson("/api/planning/{$affectation->id}", ['date' => '2026-10-01'])
        ->assertOk()
        ->assertJsonPath('data.date', '2026-10-01')
        ->assertJsonCount(1, 'data.workers');

    $this->putJson("/api/planning/{$affectation->id}", ['worker_ids' => [$b->id]])
        ->assertOk()
        ->assertJsonCount(1, 'data.workers')
        ->assertJsonPath('data.workers.0.id', $b->id);

    $this->deleteJson("/api/planning/{$affectation->id}")->assertOk();
    $this->assertDatabaseMissing('affectations', ['id' => $affectation->id]);
});

it('masque les affectations d\'un chantier supprimé', function () {
    actingAsAdmin();
    $chantier = Chantier::factory()->create();
    Affectation::factory()->create(['chantier_id' => $chantier->id, 'date' => '2026-09-29']);

    $chantier->delete();

    $this->getJson('/api/planning?from=2026-09-28&to=2026-10-04')->assertOk()->assertJsonCount(0, 'data');
});

it('copie une semaine sur une autre avec les équipes', function () {
    actingAsRole('chef');
    $chantier = Chantier::factory()->create();
    $worker = makeWorker();
    $source = Affectation::factory()->create(['chantier_id' => $chantier->id, 'date' => '2026-09-29', 'start_time' => '07:30', 'end_time' => '12:00']);
    $source->workers()->sync([$worker->id]);
    // Une affectation déjà présente sur la semaine cible.
    Affectation::factory()->create(['chantier_id' => $chantier->id, 'date' => '2026-10-07']);

    $this->postJson('/api/planning/copy-week', ['from' => '2026-09-28', 'to' => '2026-10-05'])
        ->assertOk()
        ->assertJsonPath('created', 1);

    $this->getJson('/api/planning?from=2026-10-05&to=2026-10-11')
        ->assertOk()
        ->assertJsonCount(2, 'data');

    $copied = Affectation::where('date', '2026-10-06')->first();
    expect($copied)->not->toBeNull()
        ->and($copied->start_time)->toBe('07:30')
        ->and($copied->workers()->pluck('users.id')->all())->toBe([$worker->id]);

    // Avec replace : la semaine cible est vidée avant copie.
    $this->postJson('/api/planning/copy-week', ['from' => '2026-09-28', 'to' => '2026-10-05', 'replace' => true])
        ->assertOk()
        ->assertJsonPath('created', 1);

    $this->getJson('/api/planning?from=2026-10-05&to=2026-10-11')->assertOk()->assertJsonCount(1, 'data');
});

it('liste l\'équipe affectable pour un planificateur', function () {
    actingAsAdmin();
    makeWorker('Zoé');
    makeWorker('Alice');

    $this->getJson('/api/workers')
        ->assertOk()
        ->assertJsonCount(2, 'data')
        ->assertJsonPath('data.0.name', 'Alice')
        ->assertJsonStructure(['data' => [['id', 'name', 'job_title', 'color', 'roles']]]);
});

it('expose l\'état du jour dans le tableau de bord d\'un planificateur', function () {
    actingAsRole('chef');
    $chantier = Chantier::factory()->create(['status' => 'active']);
    $worker = makeWorker();
    makeWorker('Libre');
    $today = Affectation::factory()->create(['chantier_id' => $chantier->id, 'date' => now()->toDateString()]);
    $today->workers()->sync([$worker->id]);

    $this->getJson('/api/dashboard')
        ->assertOk()
        ->assertJsonPath('is_planner', true)
        ->assertJsonCount(1, 'planning.today_affectations')
        ->assertJsonPath('planning.workers_assigned_today', 1)
        ->assertJsonPath('planning.chantiers_active', 1)
        // Le chef connecté est lui-même affectable : lui + « Libre » sont disponibles.
        ->assertJsonCount(2, 'planning.workers_free_today');
});
