<?php

use App\Models\Invitation;
use App\Models\User;
use App\Notifications\InvitationNotification;
use App\Support\Modules;
use Illuminate\Support\Facades\Notification;

/**
 * Crée une invitation en base et renvoie [invitation, token en clair].
 *
 * @param  array<string, mixed>  $attributes
 * @return array{0: Invitation, 1: string}
 */
function makeInvitation(array $attributes = []): array
{
    $token = Invitation::generateToken();

    $invitation = Invitation::factory()->create([
        'token_hash' => Invitation::hashToken($token),
        ...$attributes,
    ]);

    return [$invitation, $token];
}

// ---------------------------------------------------------------- Émission

it('permet à un admin d\'inviter une adresse', function () {
    Notification::fake();
    $admin = actingAsAdmin();

    $response = $this->postJson('/api/invitations', ['email' => 'nouveau@example.com']);

    $response->assertCreated()
        ->assertJsonStructure(['data' => ['id', 'email', 'role', 'status', 'expires_at'], 'accept_url'])
        ->assertJsonPath('data.email', 'nouveau@example.com')
        ->assertJsonPath('data.status', 'pending')
        ->assertJsonPath('data.role', 'ouvrier');

    $this->assertDatabaseHas('invitations', ['email' => 'nouveau@example.com', 'invited_by' => $admin->id]);
    expect($response->json('data'))->not->toHaveKey('token_hash');
});

it('envoie le lien d\'invitation par email au destinataire', function () {
    Notification::fake();
    actingAsAdmin();

    $this->postJson('/api/invitations', ['email' => 'nouveau@example.com'])->assertCreated();

    Notification::assertSentOnDemand(
        InvitationNotification::class,
        fn ($notification, $channels, $notifiable) => $notifiable->routes['mail'] === 'nouveau@example.com'
    );
});

it('interdit à un non-admin d\'inviter par défaut', function () {
    Notification::fake();
    actingAsUser();

    $this->postJson('/api/invitations', ['email' => 'nouveau@example.com'])->assertForbidden();
});

it('autorise tout le monde à inviter si la config le permet', function () {
    Notification::fake();
    config(['invitations.who_can_invite' => 'everyone']);
    actingAsUser();

    $this->postJson('/api/invitations', ['email' => 'nouveau@example.com'])->assertCreated();
});

it('empêche un non-admin d\'inviter avec le rôle admin', function () {
    Notification::fake();
    config(['invitations.who_can_invite' => 'everyone']);
    actingAsUser();

    $this->postJson('/api/invitations', ['email' => 'promu@example.com', 'role' => 'admin'])
        ->assertStatus(422)
        ->assertJsonValidationErrors('role');
});

it('refuse d\'inviter une adresse déjà associée à un compte', function () {
    Notification::fake();
    actingAsAdmin();
    User::factory()->create(['email' => 'deja@example.com']);

    $this->postJson('/api/invitations', ['email' => 'deja@example.com'])
        ->assertStatus(422)
        ->assertJsonValidationErrors('email');
});

it('refuse une seconde invitation en attente pour la même adresse', function () {
    Notification::fake();
    $admin = actingAsAdmin();
    makeInvitation(['email' => 'double@example.com', 'invited_by' => $admin->id]);

    $this->postJson('/api/invitations', ['email' => 'double@example.com'])
        ->assertStatus(422)
        ->assertJsonValidationErrors('email');
});

it('renvoie 404 quand le module invitations est désactivé', function () {
    actingAsAdmin();
    Modules::setMany(['invitations' => false]);

    $this->getJson('/api/invitations')->assertNotFound();
});

// ------------------------------------------------------------ Consultation

it('renvoie les infos du formulaire pour un lien valide', function () {
    $inviter = User::factory()->create(['name' => 'Camille']);
    [, $token] = makeInvitation(['email' => 'invite@example.com', 'invited_by' => $inviter->id]);

    $this->getJson("/api/register/{$token}")
        ->assertOk()
        ->assertJson(['email' => 'invite@example.com', 'inviter_name' => 'Camille']);
});

it('renvoie 404 pour un token inconnu', function () {
    $this->getJson('/api/register/token-qui-nexiste-pas')->assertNotFound();
});

it('renvoie 410 pour une invitation expirée ou déjà acceptée', function () {
    [, $expired] = makeInvitation(['expires_at' => now()->subDay()]);
    [, $accepted] = makeInvitation(['accepted_at' => now()]);

    $this->getJson("/api/register/{$expired}")->assertStatus(410)->assertJsonStructure(['message']);
    $this->getJson("/api/register/{$accepted}")->assertStatus(410);
});

// ------------------------------------------------------------- Acceptation

it('crée le compte et connecte l\'utilisateur', function () {
    ensureRoles();
    [$invitation, $token] = makeInvitation(['email' => 'invite@example.com']);

    $response = $this->postJson("/api/register/{$token}", [
        'name' => 'Nouvelle Personne',
        'password' => 'motdepasse123',
        'password_confirmation' => 'motdepasse123',
    ]);

    $response->assertCreated()
        ->assertJsonStructure(['token', 'user' => ['id', 'name', 'email', 'roles']])
        ->assertJsonPath('user.email', 'invite@example.com');

    $created = User::where('email', 'invite@example.com')->first();
    expect($created)->not->toBeNull()
        ->and($created->hasRole('ouvrier'))->toBeTrue()
        ->and($created->email_verified_at)->not->toBeNull();

    expect($invitation->fresh()->accepted_at)->not->toBeNull()
        ->and($invitation->fresh()->accepted_by)->toBe($created->id);
});

it('ignore un email fourni par le client et utilise celui de l\'invitation', function () {
    ensureRoles();
    [, $token] = makeInvitation(['email' => 'invite@example.com']);

    $this->postJson("/api/register/{$token}", [
        'name' => 'Pirate',
        'email' => 'attaquant@example.com',
        'password' => 'motdepasse123',
        'password_confirmation' => 'motdepasse123',
    ])->assertCreated();

    $this->assertDatabaseHas('users', ['email' => 'invite@example.com']);
    $this->assertDatabaseMissing('users', ['email' => 'attaquant@example.com']);
});

it('refuse de réutiliser un lien déjà consommé', function () {
    ensureRoles();
    [, $token] = makeInvitation();
    $payload = ['name' => 'Première', 'password' => 'motdepasse123', 'password_confirmation' => 'motdepasse123'];

    $this->postJson("/api/register/{$token}", $payload)->assertCreated();
    $this->postJson("/api/register/{$token}", $payload)->assertStatus(410);

    // L'inviteur créé par la factory + le compte issu de l'invitation.
    expect(User::count())->toBe(2);
});

// -------------------------------------------------------- Liste / révocation

it('ne liste que ses propres invitations pour un non-admin', function () {
    config(['invitations.who_can_invite' => 'everyone']);
    $inviter = actingAsUser();
    makeInvitation(['invited_by' => $inviter->id]);
    makeInvitation(); // émise par quelqu'un d'autre

    $response = $this->getJson('/api/invitations')->assertOk();

    expect($response->json('data'))->toHaveCount(1);
});

it('liste toutes les invitations pour un admin', function () {
    actingAsAdmin();
    makeInvitation();
    makeInvitation();

    $response = $this->getJson('/api/invitations')->assertOk();

    expect($response->json('data'))->toHaveCount(2);
});

it('permet à l\'inviteur de révoquer son invitation, pas à un tiers', function () {
    $inviter = actingAsUser();
    [$mine] = makeInvitation(['invited_by' => $inviter->id]);
    [$other] = makeInvitation();

    $this->deleteJson("/api/invitations/{$mine->id}")->assertOk();
    $this->assertDatabaseMissing('invitations', ['id' => $mine->id]);

    $this->deleteJson("/api/invitations/{$other->id}")->assertForbidden();
    $this->assertDatabaseHas('invitations', ['id' => $other->id]);
});

it('refuse de révoquer une invitation déjà acceptée', function () {
    actingAsAdmin();
    [$invitation] = makeInvitation(['accepted_at' => now()]);

    $this->deleteJson("/api/invitations/{$invitation->id}")->assertStatus(422);
});
