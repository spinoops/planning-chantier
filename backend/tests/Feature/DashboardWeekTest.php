<?php

beforeEach(fn () => ensureRoles());

it('compte les chantiers de chaque jour dans la semaine en un coup d’œil', function () {
    actingAsRole('gestionnaire');
    $ouvrier = actingAsRole('ouvrier');
    actingAsRole('gestionnaire');

    $chantier = $this->postJson('/api/chantiers', [
        'name' => 'Toiture Monnin', 'client' => 'Monnin', 'color' => '#e30917', 'status' => 'active',
    ])->assertCreated()->json('data');

    $today = now()->toDateString();
    $this->postJson('/api/planning', [
        'chantier_id' => $chantier['id'], 'date' => $today, 'start_time' => '08:00', 'end_time' => '12:00', 'worker_ids' => [$ouvrier->id],
    ])->assertCreated();
    $this->postJson('/api/planning', [
        'chantier_id' => $chantier['id'], 'date' => $today, 'start_time' => '13:00', 'end_time' => '17:00', 'worker_ids' => [],
    ])->assertCreated();

    $days = collect($this->getJson('/api/dashboard')->assertOk()->json('week.days'));
    $day = $days->firstWhere('date', $today);

    expect($days)->toHaveCount(7)
        ->and($day['affectations'])->toBe(2)
        ->and($day['unstaffed'])->toBe(1)
        ->and(collect($day['free'])->pluck('id'))->not->toContain($ouvrier->id)
        ->and($days->where('date', '!=', $today)->sum('affectations'))->toBe(0);
});
