<?php

use App\Models\Affectation;
use App\Models\Chantier;
use App\Models\TimeEntry;
use App\Models\User;
use Laravel\Sanctum\Sanctum;

function worker(string $name = 'Ouvrier'): User
{
    ensureRoles();
    $u = User::factory()->create(['name' => $name]);
    $u->assignRole('ouvrier');

    return $u;
}

it('permet à un ouvrier de pointer ses heures sur son affectation puis de les soumettre', function () {
    $me = actingAsRole('ouvrier');
    $chantier = Chantier::factory()->create();
    $a = Affectation::factory()->create(['chantier_id' => $chantier->id, 'date' => '2026-10-06', 'start_time' => '07:30', 'end_time' => '16:45']);
    $a->syncPeople([$me->id]);

    $id = $this->postJson('/api/heures', [
        'affectation_id' => $a->id,
        'date' => '2026-10-06',
        'start_time' => '07:30',
        'end_time' => '16:30',
        'break_minutes' => 45,
        'comment' => 'Coulage dalle',
    ])
        ->assertCreated()
        ->assertJsonPath('data.chantier_id', $chantier->id)
        ->assertJsonPath('data.minutes', 495)
        ->assertJsonPath('data.status', 'draft')
        ->json('data.id');

    $this->getJson('/api/heures?from=2026-10-05&to=2026-10-11')->assertOk()->assertJsonCount(1, 'data');

    $this->postJson('/api/heures/submit', ['ids' => [$id]])->assertOk()->assertJsonPath('count', 1);
    expect(TimeEntry::find($id)->status)->toBe('submitted');

    // Une correction par l'ouvrier remet en brouillon.
    $this->putJson("/api/heures/{$id}", ['end_time' => '17:00'])->assertOk()->assertJsonPath('data.status', 'draft');

    // Il ne peut pas valider ni pointer pour un autre.
    $this->postJson('/api/heures/validate', ['ids' => [$id]])->assertForbidden();
    $other = worker('Autre');
    $this->postJson('/api/heures', ['user_id' => $other->id, 'date' => '2026-10-06', 'start_time' => '08:00', 'end_time' => '12:00'])
        ->assertCreated()
        ->assertJsonPath('data.user_id', $me->id);
});

it('refuse à un ouvrier de pointer sur une affectation où il ne figure pas', function () {
    actingAsRole('ouvrier');
    $a = Affectation::factory()->create(['date' => '2026-10-06']);

    $this->postJson('/api/heures', ['affectation_id' => $a->id, 'date' => '2026-10-06', 'start_time' => '08:00', 'end_time' => '12:00'])
        ->assertForbidden();
});

it('valide des heures, les verrouille pour l\'ouvrier et fournit une synthèse', function () {
    $chef = actingAsRole('chef');
    $alice = worker('Alice');
    $chantier = Chantier::factory()->create();
    $a = Affectation::factory()->create(['chantier_id' => $chantier->id, 'date' => '2026-10-06', 'start_time' => '08:00', 'end_time' => '12:00']);
    $a->syncPeople([$alice->id]);
    $entry = TimeEntry::create(['user_id' => $alice->id, 'affectation_id' => $a->id, 'chantier_id' => $chantier->id, 'date' => '2026-10-06', 'start_time' => '08:00', 'end_time' => '12:30', 'break_minutes' => 30, 'status' => 'submitted']);

    $this->postJson('/api/heures/validate', ['ids' => [$entry->id]])->assertOk()->assertJsonPath('count', 1);
    expect($entry->fresh()->status)->toBe('validated')->and($entry->fresh()->validated_by)->toBe($chef->id);

    $summary = $this->getJson('/api/heures/summary?from=2026-10-05&to=2026-10-11')->assertOk()->json();
    $row = collect($summary['by_user'])->firstWhere('user.id', $alice->id);
    expect($row['planned_minutes'])->toBe(240)
        ->and($row['worked_minutes'])->toBe(240)
        ->and($row['validated'])->toBe(1)
        ->and($summary['by_chantier'][0]['chantier']['id'])->toBe($chantier->id);

    // Verrouillé pour l'ouvrier, modifiable après réouverture.
    Sanctum::actingAs($alice);
    $this->putJson("/api/heures/{$entry->id}", ['end_time' => '13:00'])->assertStatus(422);
    $this->deleteJson("/api/heures/{$entry->id}")->assertStatus(422);

    Sanctum::actingAs($chef);
    $this->postJson('/api/heures/reopen', ['ids' => [$entry->id]])->assertOk();
    expect($entry->fresh()->status)->toBe('draft');
});

it('valide les heures saisies (fin après début)', function () {
    actingAsRole('ouvrier');

    $this->postJson('/api/heures', ['date' => '2026-10-06', 'start_time' => '12:00', 'end_time' => '08:00'])
        ->assertStatus(422)
        ->assertJsonValidationErrors(['end_time']);
});
