<?php

use App\Models\Absence;
use App\Models\Affectation;
use App\Models\Chantier;
use App\Models\Equipe;
use App\Models\Setting;
use App\Models\User;
use App\Notifications\PlanningChangedNotification;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;

function ouvrier(string $name = 'Ouvrier'): User
{
    ensureRoles();
    $u = User::factory()->create(['name' => $name]);
    $u->assignRole('ouvrier');

    return $u;
}

it('répète une affectation sur les jours ouvrés jusqu\'à une date', function () {
    actingAsRole('chef');
    $chantier = Chantier::factory()->create();
    $worker = ouvrier();

    // Lundi 5 → jusqu'au dimanche 11 octobre 2026, lun–ven par défaut : 5 affectations.
    $this->postJson('/api/planning', [
        'chantier_id' => $chantier->id,
        'date' => '2026-10-05',
        'start_time' => '07:30',
        'end_time' => '12:00',
        'worker_ids' => [$worker->id],
        'repeat_until' => '2026-10-11',
    ])
        ->assertCreated()
        ->assertJsonPath('created', 5);

    expect(Affectation::count())->toBe(5)
        ->and(Affectation::pluck('date')->map(fn ($d) => $d->format('D'))->unique()->all())->not->toContain('Sat', 'Sun');

    // Jours choisis : seulement mercredi.
    $this->postJson('/api/planning', [
        'chantier_id' => $chantier->id,
        'date' => '2026-10-12',
        'worker_ids' => [],
        'repeat_until' => '2026-10-25',
        'repeat_days' => [3],
    ])->assertCreated()->assertJsonPath('created', 3); // le 12 (lundi, départ) + 14 + 21
});

it('attache un passage (visiteur) sans l\'inclure dans l\'équipe', function () {
    $chef = actingAsRole('chef');
    $chantier = Chantier::factory()->create();
    $worker = ouvrier();

    $id = $this->postJson('/api/planning', [
        'chantier_id' => $chantier->id,
        'date' => '2026-10-06',
        'worker_ids' => [$worker->id],
        'visitor_ids' => [$chef->id],
        'phase' => 'Gros œuvre',
    ])
        ->assertCreated()
        ->assertJsonCount(1, 'data.workers')
        ->assertJsonCount(1, 'data.visitors')
        ->assertJsonPath('data.visitors.0.id', $chef->id)
        ->assertJsonPath('data.phase', 'Gros œuvre')
        ->json('data.id');

    // Le visiteur voit l'affectation dans « Mon planning ».
    $this->getJson('/api/planning?from=2026-10-05&to=2026-10-11&mine=1')->assertOk()->assertJsonPath('data.0.id', $id);

    // Retirer le passage sans toucher l'équipe.
    $this->putJson("/api/planning/{$id}", ['visitor_ids' => []])->assertOk()->assertJsonCount(0, 'data.visitors')->assertJsonCount(1, 'data.workers');
});

it('gère les absences et liste les absents de la période', function () {
    actingAsRole('chef');
    $worker = ouvrier('Léo');

    $id = $this->postJson('/api/absences', ['user_id' => $worker->id, 'start_date' => '2026-10-12', 'end_date' => '2026-10-16', 'type' => 'vacances'])
        ->assertCreated()
        ->assertJsonPath('data.type_label', 'Vacances')
        ->json('data.id');

    $this->getJson('/api/absences?from=2026-10-14&to=2026-10-14')->assertOk()->assertJsonCount(1, 'data');
    $this->getJson('/api/absences?from=2026-10-19&to=2026-10-25')->assertOk()->assertJsonCount(0, 'data');
    expect(Absence::absentUserIds('2026-10-13'))->toBe([$worker->id]);

    $this->postJson('/api/absences', ['user_id' => $worker->id, 'start_date' => '2026-10-12', 'end_date' => '2026-10-10', 'type' => 'vacances'])
        ->assertStatus(422);

    $this->deleteJson("/api/absences/{$id}")->assertOk();
});

it('laisse un ouvrier signaler un imprévu que le bureau marque comme traité', function () {
    $me = actingAsRole('ouvrier');

    $id = $this->postJson('/api/signalements', ['type' => 'materiel', 'message' => 'Il manque la scie circulaire.', 'date' => '2026-10-06'])
        ->assertCreated()
        ->assertJsonPath('data.type_label', 'Matériel manquant')
        ->json('data.id');

    $this->postJson("/api/signalements/{$id}/read")->assertForbidden();
    $this->getJson('/api/signalements')->assertOk()->assertJsonCount(1, 'data');

    $chef = actingAsRole('chef');
    $this->postJson("/api/signalements/{$id}/read")->assertOk();
    $this->getJson('/api/signalements?unread=1')->assertOk()->assertJsonCount(0, 'data');
    $this->getJson('/api/dashboard')->assertOk()->assertJsonPath('week.unread_signalements', 0);
    expect($me->id)->not->toBe($chef->id);
});

it('ajoute et supprime une photo sur une affectation', function () {
    Storage::fake('public');
    $me = actingAsRole('ouvrier');
    $a = Affectation::factory()->create(['date' => '2026-10-06']);
    $a->syncPeople([$me->id]);

    $photo = $this->post("/api/planning/{$a->id}/photos", ['file' => UploadedFile::fake()->image('fin.jpg', 800, 600), 'caption' => 'Dalle terminée'], ['Accept' => 'application/json'])
        ->assertCreated()
        ->assertJsonPath('data.caption', 'Dalle terminée')
        ->json('data');

    Storage::disk('public')->assertExists("affectations/{$a->id}/".basename($photo['url']));
    $this->getJson("/api/planning/{$a->id}/photos")->assertOk()->assertJsonCount(1, 'data');
    $this->getJson("/api/planning/{$a->id}")->assertOk()->assertJsonPath('data.photos_count', 1);

    $this->deleteJson("/api/planning/{$a->id}/photos/{$photo['id']}")->assertOk();
    Storage::disk('public')->assertMissing("affectations/{$a->id}/".basename($photo['url']));
});

it('prévient les planificateurs d\'un changement tardif du planning du lendemain', function () {
    Notification::fake();
    Carbon::setTestNow(Carbon::parse('2026-10-06 17:30:00'));
    Setting::setMany(['planning_notify_after' => '16:00']);

    $actor = actingAsRole('chef');
    ensureRoles();
    $other = User::factory()->create();
    $other->assignRole('chef');
    $chantier = Chantier::factory()->create();

    // Demain → notification à l'autre planificateur, pas à l'auteur.
    $this->postJson('/api/planning', ['chantier_id' => $chantier->id, 'date' => '2026-10-07', 'worker_ids' => []])->assertCreated();
    Notification::assertSentTo($other, PlanningChangedNotification::class);
    Notification::assertNotSentTo($actor, PlanningChangedNotification::class);

    // Dans dix jours → rien.
    Notification::fake();
    $this->postJson('/api/planning', ['chantier_id' => $chantier->id, 'date' => '2026-10-16', 'worker_ids' => []])->assertCreated();
    Notification::assertNothingSent();

    // Avant l'heure de veille → rien.
    Carbon::setTestNow(Carbon::parse('2026-10-06 10:00:00'));
    $this->postJson('/api/planning', ['chantier_id' => $chantier->id, 'date' => '2026-10-07', 'worker_ids' => []])->assertCreated();
    Notification::assertNothingSent();

    Carbon::setTestNow();
});

it('masque les équipes temporaires expirées sauf avec ?all=1', function () {
    actingAsRole('chef');
    Equipe::factory()->create(['name' => 'Permanente']);
    Equipe::factory()->create(['name' => 'Binôme semaine 40', 'expires_at' => now()->subDay()->toDateString()]);

    $this->getJson('/api/equipes')->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.name', 'Permanente');
    $this->getJson('/api/equipes?all=1')->assertOk()->assertJsonCount(2, 'data');

    $this->postJson('/api/equipes', ['name' => 'Temp', 'color' => '#2563eb', 'expires_at' => now()->addDays(5)->toDateString(), 'member_ids' => []])
        ->assertCreated()
        ->assertJsonPath('data.expires_at', now()->addDays(5)->toDateString());
});

it('expose les horaires types dans les réglages et les met à jour', function () {
    $this->getJson('/api/settings')->assertOk()->assertJsonPath('planning_morning_start', '07:30');

    actingAsAdmin();
    $this->putJson('/api/settings', ['app_name' => 'Test', 'app_color' => '#ea580c', 'planning_morning_start' => '07:00', 'planning_morning_end' => '11:30'])
        ->assertOk()
        ->assertJsonPath('planning_morning_start', '07:00');
    $this->putJson('/api/settings', ['app_name' => 'Test', 'app_color' => '#ea580c', 'planning_morning_start' => '12:00', 'planning_morning_end' => '11:30'])
        ->assertStatus(422);
});
