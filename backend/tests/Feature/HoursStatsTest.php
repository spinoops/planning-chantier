<?php

use App\Models\Affectation;
use App\Models\Chantier;
use App\Models\TimeEntry;
use App\Models\User;
use Illuminate\Support\Carbon;

beforeEach(fn () => ensureRoles());
afterEach(fn () => Carbon::setTestNow());

function hoursEmploye(string $name): User
{
    $u = User::factory()->create(['name' => $name]);
    $u->assignRole('ouvrier');

    return $u;
}

it('donne la grille jour par jour, les heures par statut et les oublis de pointage', function () {
    Carbon::setTestNow(Carbon::parse('2026-10-08 12:00'));
    actingAsRole('gestionnaire');
    $leo = hoursEmploye('Léo');
    $chantier = Chantier::factory()->create();

    // Lundi : planifié 8h, pointé 7h45 (soumis). Mardi : planifié, rien pointé (oubli). Jeudi : futur, planifié.
    foreach (['2026-10-05', '2026-10-06', '2026-10-09'] as $date) {
        $a = Affectation::factory()->create(['chantier_id' => $chantier->id, 'date' => $date, 'start_time' => '08:00', 'end_time' => '16:00']);
        $a->syncPeople([$leo->id]);
    }
    TimeEntry::create(['user_id' => $leo->id, 'chantier_id' => $chantier->id, 'date' => '2026-10-05', 'start_time' => '07:30', 'end_time' => '16:00', 'break_minutes' => 45, 'status' => 'submitted']);
    TimeEntry::create(['user_id' => $leo->id, 'chantier_id' => $chantier->id, 'date' => '2026-10-07', 'start_time' => '08:00', 'end_time' => '12:00', 'break_minutes' => 0, 'status' => 'validated']);

    $res = $this->getJson('/api/heures/summary?from=2026-10-05&to=2026-10-11')->assertOk();

    $row = collect($res->json('by_user'))->firstWhere('user.id', $leo->id);
    expect($row['planned_minutes'])->toBe(3 * 480)
        ->and($row['worked_minutes'])->toBe(465 + 240)
        ->and($row['submitted_minutes'])->toBe(465)
        ->and($row['validated_minutes'])->toBe(240)
        ->and($row['days_worked'])->toBe(2)
        ->and($row['days_planned'])->toBe(3)
        ->and($row['missing_days'])->toBe(1);

    $lundi = collect($res->json('grid'))->first(fn ($c) => $c['user_id'] === $leo->id && $c['date'] === '2026-10-05');
    expect($lundi['planned_minutes'])->toBe(480)
        ->and($lundi['worked_minutes'])->toBe(465)
        ->and($lundi['submitted'])->toBe(1);

    expect($res->json('totals.missing_days'))->toBe(1)
        ->and($res->json('totals.validated'))->toBe(1);
});

it('exporte les heures de la période en CSV', function () {
    actingAsRole('gestionnaire');
    $leo = hoursEmploye('Léo Lançon');
    $chantier = Chantier::factory()->create(['name' => 'Toiture Monnin']);
    TimeEntry::create(['user_id' => $leo->id, 'chantier_id' => $chantier->id, 'date' => '2026-10-05', 'start_time' => '07:30', 'end_time' => '16:00', 'break_minutes' => 30, 'status' => 'validated']);

    $csv = $this->get('/api/heures/export.csv?from=2026-10-05&to=2026-10-11')->assertOk()->streamedContent();

    expect($csv)->toContain('"Léo Lançon";8.00;0.00;0.00;8.00;1;1')
        ->and($csv)->toContain('2026-10-05;"Léo Lançon";"Toiture Monnin";07:30;16:00;30;8.00;Validé');
});

it('réserve la synthèse et l\'export aux planificateurs', function () {
    actingAsRole('ouvrier');

    $this->getJson('/api/heures/summary')->assertForbidden();
    $this->get('/api/heures/export.csv')->assertForbidden();
});

it('laisse un chef corriger et valider les heures d\'un employé', function () {
    actingAsRole('chef');
    $leo = hoursEmploye('Léo');
    $entry = TimeEntry::create(['user_id' => $leo->id, 'date' => '2026-10-05', 'start_time' => '07:30', 'end_time' => '17:00', 'break_minutes' => 0, 'status' => 'submitted']);

    $this->putJson("/api/heures/{$entry->id}", ['start_time' => '07:30', 'end_time' => '16:30', 'break_minutes' => 45])
        ->assertOk()
        ->assertJsonPath('data.minutes', 495)
        ->assertJsonPath('data.status', 'submitted');

    $this->postJson('/api/heures/validate', ['ids' => [$entry->id]])->assertOk()->assertJsonPath('count', 1);
    expect($entry->fresh()->status)->toBe('validated');
});

it('filtre le planning sur l’employé demandé (worker_id)', function () {
    actingAsRole('gestionnaire');
    $leo = hoursEmploye('Léo');
    $david = hoursEmploye('David');
    $chantier = Chantier::factory()->create();
    $a = Affectation::factory()->create(['chantier_id' => $chantier->id, 'date' => '2026-10-06']);
    $a->syncPeople([$leo->id]);
    $b = Affectation::factory()->create(['chantier_id' => $chantier->id, 'date' => '2026-10-06']);
    $b->syncPeople([$david->id]);

    $ids = collect($this->getJson("/api/planning?from=2026-10-06&to=2026-10-06&worker_id={$leo->id}")->assertOk()->json('data'))->pluck('id');

    expect($ids->all())->toBe([$a->id]);
});
