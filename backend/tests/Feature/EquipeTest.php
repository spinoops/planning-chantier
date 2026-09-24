<?php

use App\Models\Affectation;
use App\Models\Chantier;
use App\Models\Equipe;
use App\Models\User;

function makeMember(string $name = 'Membre'): User
{
    ensureRoles();
    $user = User::factory()->create(['name' => $name]);
    $user->assignRole('ouvrier');

    return $user;
}

it('liste les équipes avec leurs membres pour tout utilisateur connecté', function () {
    actingAsRole('ouvrier');
    $equipe = Equipe::factory()->create(['name' => 'Robin', 'color' => '#ef4444']);
    makeMember('Robin Braun')->update(['equipe_id' => $equipe->id]);

    $this->getJson('/api/equipes')
        ->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.name', 'Robin')
        ->assertJsonPath('data.0.color', '#ef4444')
        ->assertJsonCount(1, 'data.0.members')
        ->assertJsonPath('data.0.members.0.name', 'Robin Braun');

    $this->postJson('/api/equipes', ['name' => 'X', 'color' => '#000000'])->assertForbidden();
});

it('permet à un chef de créer une équipe avec ses membres, puis de les changer', function () {
    actingAsRole('chef');
    $a = makeMember('Alice');
    $b = makeMember('Bob');
    $other = Equipe::factory()->create();
    $a->update(['equipe_id' => $other->id]);

    $id = $this->postJson('/api/equipes', ['name' => 'Duo', 'color' => '#2563eb', 'member_ids' => [$a->id, $b->id]])
        ->assertCreated()
        ->assertJsonCount(2, 'data.members')
        ->json('data.id');

    // Alice a quitté son ancienne équipe.
    expect($a->fresh()->equipe_id)->toBe($id)
        ->and($other->fresh()->members()->count())->toBe(0);

    $this->putJson("/api/equipes/{$id}", ['name' => 'Solo', 'color' => '#16a34a', 'member_ids' => [$b->id]])
        ->assertOk()
        ->assertJsonPath('data.name', 'Solo')
        ->assertJsonCount(1, 'data.members')
        ->assertJsonPath('data.members.0.id', $b->id);

    expect($a->fresh()->equipe_id)->toBeNull();

    $this->deleteJson("/api/equipes/{$id}")->assertOk();
    expect($b->fresh()->equipe_id)->toBeNull();
});

it('valide une équipe (422)', function () {
    actingAsAdmin();

    $this->postJson('/api/equipes', ['name' => '', 'color' => 'rouge', 'member_ids' => [999]])
        ->assertStatus(422)
        ->assertJsonValidationErrors(['name', 'color', 'member_ids.0']);
});

it('recopie les membres de l\'équipe dans une affectation créée sans ouvriers', function () {
    actingAsRole('chef');
    $chantier = Chantier::factory()->create();
    $equipe = Equipe::factory()->create();
    $a = makeMember('Alice');
    $b = makeMember('Bob');
    User::whereIn('id', [$a->id, $b->id])->update(['equipe_id' => $equipe->id]);

    $this->postJson('/api/planning', [
        'chantier_id' => $chantier->id,
        'equipe_id' => $equipe->id,
        'date' => '2026-09-28',
        'start_time' => '08:00',
        'end_time' => '12:00',
    ])
        ->assertCreated()
        ->assertJsonPath('data.equipe.id', $equipe->id)
        ->assertJsonCount(2, 'data.workers');

    // Avec worker_ids explicites, ceux-ci priment.
    $this->postJson('/api/planning', [
        'chantier_id' => $chantier->id,
        'equipe_id' => $equipe->id,
        'date' => '2026-09-28',
        'worker_ids' => [$a->id],
    ])
        ->assertCreated()
        ->assertJsonCount(1, 'data.workers');
});

it('change les ouvriers quand une affectation passe à une autre équipe', function () {
    actingAsRole('chef');
    $chantier = Chantier::factory()->create();
    $team1 = Equipe::factory()->create();
    $team2 = Equipe::factory()->create();
    $a = makeMember('Alice');
    $b = makeMember('Bob');
    $a->update(['equipe_id' => $team1->id]);
    $b->update(['equipe_id' => $team2->id]);

    $affectation = Affectation::factory()->create(['chantier_id' => $chantier->id, 'equipe_id' => $team1->id, 'date' => '2026-09-29']);
    $affectation->workers()->sync([$a->id]);

    $this->putJson("/api/planning/{$affectation->id}", ['equipe_id' => $team2->id, 'date' => '2026-09-30'])
        ->assertOk()
        ->assertJsonPath('data.equipe.id', $team2->id)
        ->assertJsonPath('data.date', '2026-09-30')
        ->assertJsonCount(1, 'data.workers')
        ->assertJsonPath('data.workers.0.id', $b->id);

    // Filtre par équipe.
    $this->getJson("/api/planning?from=2026-09-28&to=2026-10-04&equipe_id={$team1->id}")->assertOk()->assertJsonCount(0, 'data');
    $this->getJson("/api/planning?from=2026-09-28&to=2026-10-04&equipe_id={$team2->id}")->assertOk()->assertJsonCount(1, 'data');
});

it('conserve l\'équipe lors de la copie de semaine', function () {
    actingAsRole('chef');
    $chantier = Chantier::factory()->create();
    $equipe = Equipe::factory()->create();
    Affectation::factory()->create(['chantier_id' => $chantier->id, 'equipe_id' => $equipe->id, 'date' => '2026-09-29']);

    $this->postJson('/api/planning/copy-week', ['from' => '2026-09-28', 'to' => '2026-10-05'])->assertOk();

    expect(Affectation::where('date', '2026-10-06')->value('equipe_id'))->toBe($equipe->id);
});
