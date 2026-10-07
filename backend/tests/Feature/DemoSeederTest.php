<?php

use App\Models\TimeEntry;
use App\Models\User;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Support\Carbon;

afterEach(fn () => Carbon::setTestNow());

it('sème des pointages de démo exploitables par Statistiques → Heures', function () {
    // Mercredi : lundi et mardi de la semaine sont passés, la semaine précédente aussi.
    Carbon::setTestNow(Carbon::parse('2026-10-07 10:00'));
    $this->seed(DatabaseSeeder::class);

    $leo = User::where('email', 'leo@baseapp.test')->first();
    $david = User::where('email', 'david@baseapp.test')->first();

    expect(TimeEntry::where('date', '<', '2026-10-05')->where('status', '!=', 'validated')->count())->toBe(0)
        ->and(TimeEntry::where('date', '2026-10-05')->where('status', 'submitted')->count())->toBeGreaterThan(0)
        ->and(TimeEntry::where('date', '2026-10-06')->where('status', 'draft')->count())->toBeGreaterThan(0)
        ->and(TimeEntry::where('date', '>=', '2026-10-07')->count())->toBe(0)
        // Oubli : Léo n'a rien pointé mardi.
        ->and(TimeEntry::where('user_id', $leo->id)->whereDate('date', '2026-10-06')->count())->toBe(0);

    // Longue journée de David mercredi dernier.
    $long = TimeEntry::where('user_id', $david->id)->whereDate('date', '2026-09-30')->get();
    expect($long->sum(fn (TimeEntry $e) => $e->minutes()))->toBeGreaterThan(600);

    $this->actingAs(User::where('email', 'robin@baseapp.test')->first());
    $summary = $this->getJson('/api/heures/summary?from=2026-10-05&to=2026-10-11')->assertOk();
    expect(collect($summary->json('by_user'))->firstWhere('user.id', $leo->id)['missing_days'])->toBe(1);
});
