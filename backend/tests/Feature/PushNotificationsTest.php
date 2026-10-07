<?php

use App\Models\Affectation;
use App\Models\Chantier;
use App\Models\User;
use App\Notifications\AffectationReminderNotification;
use App\Notifications\PlanningChangedPushNotification;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Notification;

beforeEach(function () {
    ensureRoles();
    config(['webpush.vapid.public_key' => 'BTestPublicKey', 'webpush.vapid.private_key' => 'test', 'webpush.vapid.subject' => 'mailto:test@example.com']);
});

afterEach(fn () => Carbon::setTestNow());

function subscribeDevice(User $user, string $endpoint = 'https://push.example/abc'): void
{
    $user->updatePushSubscription($endpoint, 'p256dh-key', 'auth-token', 'aesgcm');
}

function chantierDuJour(): Chantier
{
    return Chantier::create(['name' => 'Toiture Monnin', 'client' => 'Monnin', 'address' => 'Rue du Jura 4', 'city' => 'Porrentruy', 'color' => '#e30917', 'status' => 'active']);
}

it('expose la clé publique et gère les abonnements de l\'appareil', function () {
    $user = actingAsUser();

    $this->getJson('/api/push/public-key')->assertOk()->assertJsonPath('public_key', 'BTestPublicKey');

    $this->postJson('/api/push/subscriptions', [
        'endpoint' => 'https://push.example/device-1',
        'keys' => ['p256dh' => 'k', 'auth' => 'a'],
        'content_encoding' => 'aes128gcm',
    ])->assertCreated()->assertJsonPath('count', 1);

    expect($user->fresh()->pushSubscriptions()->count())->toBe(1);

    $this->deleteJson('/api/push/subscriptions', ['endpoint' => 'https://push.example/device-1'])->assertOk()->assertJsonPath('count', 0);
    $this->postJson('/api/push/subscriptions', ['endpoint' => 'x'])->assertUnprocessable();
});

it('refuse la notification de test sans appareil abonné', function () {
    actingAsUser();

    $this->postJson('/api/push/test')->assertUnprocessable();
});

it('enregistre les préférences de rappel depuis le profil', function () {
    $user = actingAsUser();

    $this->putJson('/api/profile', ['name' => $user->name, 'email' => $user->email, 'notify_before_minutes' => 30, 'notify_changes' => false])
        ->assertOk()
        ->assertJsonPath('notify_before_minutes', 30)
        ->assertJsonPath('notify_changes', false);

    $this->putJson('/api/profile', ['name' => $user->name, 'email' => $user->email, 'notify_before_minutes' => 45])->assertUnprocessable();
});

it('envoie un rappel une heure avant le chantier, une seule fois', function () {
    Notification::fake();
    Carbon::setTestNow(Carbon::parse('2026-10-07 06:30:00'));

    $ouvrier = User::factory()->create(['notify_before_minutes' => 60]);
    $ouvrier->assignRole('ouvrier');
    subscribeDevice($ouvrier);
    $sansAppareil = User::factory()->create(['notify_before_minutes' => 60]);
    $sansAppareil->assignRole('ouvrier');

    $chantier = chantierDuJour();
    $bientot = Affectation::create(['chantier_id' => $chantier->id, 'date' => '2026-10-07', 'start_time' => '07:30', 'end_time' => '12:00']);
    $bientot->syncPeople([$ouvrier->id, $sansAppareil->id], []);
    $plusTard = Affectation::create(['chantier_id' => $chantier->id, 'date' => '2026-10-07', 'start_time' => '13:00', 'end_time' => '17:00']);
    $plusTard->syncPeople([$ouvrier->id], []);

    $this->artisan('planning:remind')->assertSuccessful();
    $this->artisan('planning:remind')->assertSuccessful();

    Notification::assertSentToTimes($ouvrier, AffectationReminderNotification::class, 1);
    Notification::assertSentTo($ouvrier, AffectationReminderNotification::class, fn ($n) => $n->affectation->is($bientot) && $n->minutesBefore === 60);
    Notification::assertNotSentTo($sansAppareil, AffectationReminderNotification::class);
    $this->assertDatabaseCount('affectation_reminders', 1);
});

it('ne rappelle pas quand le délai est à zéro', function () {
    Notification::fake();
    Carbon::setTestNow(Carbon::parse('2026-10-07 06:30:00'));

    $ouvrier = User::factory()->create(['notify_before_minutes' => 0]);
    $ouvrier->assignRole('ouvrier');
    subscribeDevice($ouvrier);
    $a = Affectation::create(['chantier_id' => chantierDuJour()->id, 'date' => '2026-10-07', 'start_time' => '07:30', 'end_time' => '12:00']);
    $a->syncPeople([$ouvrier->id], []);

    $this->artisan('planning:remind')->assertSuccessful();

    Notification::assertNothingSent();
});

it('prévient les personnes concernées quand leur planning du jour change', function () {
    Notification::fake();

    $planner = actingAsRole('gestionnaire');
    $ouvrier = User::factory()->create(['notify_changes' => true]);
    $ouvrier->assignRole('ouvrier');
    subscribeDevice($ouvrier, 'https://push.example/ouvrier');
    $muet = User::factory()->create(['notify_changes' => false]);
    $muet->assignRole('ouvrier');
    subscribeDevice($muet, 'https://push.example/muet');

    $chantier = chantierDuJour();
    $id = $this->postJson('/api/planning', [
        'chantier_id' => $chantier->id, 'date' => now()->toDateString(), 'start_time' => '08:00', 'end_time' => '12:00',
        'worker_ids' => [$ouvrier->id, $muet->id],
    ])->assertCreated()->json('data.id');

    Notification::assertSentTo($ouvrier, PlanningChangedPushNotification::class, fn ($n) => $n->event === 'created');
    Notification::assertNotSentTo($muet, PlanningChangedPushNotification::class);
    Notification::assertNotSentTo($planner, PlanningChangedPushNotification::class);

    // Retiré de l'affectation : il est prévenu aussi.
    $this->putJson("/api/planning/{$id}", ['worker_ids' => [$muet->id]])->assertOk();
    Notification::assertSentTo($ouvrier, PlanningChangedPushNotification::class, fn ($n) => $n->event === 'updated');

    // Une affectation dans deux semaines ne déclenche rien.
    $this->postJson('/api/planning', ['chantier_id' => $chantier->id, 'date' => now()->addDays(14)->toDateString(), 'worker_ids' => [$ouvrier->id]])->assertCreated();
    Notification::assertSentToTimes($ouvrier, PlanningChangedPushNotification::class, 2);
});
