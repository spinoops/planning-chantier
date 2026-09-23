<?php

use App\Models\User;
use Illuminate\Support\Facades\Hash;

it('permet de modifier son nom et son email', function () {
    $user = actingAsUser();

    $this->putJson('/api/profile', ['name' => 'Nouveau Nom', 'email' => 'nouveau@example.com'])
        ->assertOk()
        ->assertJsonPath('name', 'Nouveau Nom')
        ->assertJsonPath('email', 'nouveau@example.com');

    expect($user->fresh()->email)->toBe('nouveau@example.com');
});

it('refuse un email déjà utilisé par un autre compte', function () {
    actingAsUser();
    User::factory()->create(['email' => 'pris@example.com']);

    $this->putJson('/api/profile', ['name' => 'X', 'email' => 'pris@example.com'])
        ->assertStatus(422)
        ->assertJsonValidationErrors('email');
});

it('ne permet pas de modifier ses rôles via le profil', function () {
    $user = actingAsUser();

    $this->putJson('/api/profile', ['name' => 'X', 'email' => $user->email, 'roles' => ['admin']])->assertOk();

    expect($user->fresh()->hasRole('admin'))->toBeFalse();
});

it('change le mot de passe avec l\'ancien mot de passe', function () {
    $user = actingAsUser(['password' => Hash::make('ancien-secret')]);
    $user->createToken('autre-appareil');

    $this->putJson('/api/profile/password', [
        'current_password' => 'ancien-secret',
        'password' => 'nouveau-secret',
        'password_confirmation' => 'nouveau-secret',
    ])->assertOk();

    expect(Hash::check('nouveau-secret', $user->fresh()->password))->toBeTrue()
        // Les autres appareils sont déconnectés.
        ->and($user->tokens()->count())->toBe(0);
});

it('refuse un ancien mot de passe incorrect', function () {
    actingAsUser(['password' => Hash::make('ancien-secret')]);

    $this->putJson('/api/profile/password', [
        'current_password' => 'mauvais',
        'password' => 'nouveau-secret',
        'password_confirmation' => 'nouveau-secret',
    ])->assertStatus(422)->assertJsonValidationErrors('current_password');
});

it('exige une authentification pour le profil', function () {
    $this->putJson('/api/profile', ['name' => 'X', 'email' => 'x@example.com'])->assertUnauthorized();
});

it('déconnecte de tous les appareils', function () {
    $user = User::factory()->create();
    $token = $user->createToken('a')->plainTextToken;
    $user->createToken('b');

    $this->withToken($token)->postJson('/api/logout-all')->assertOk();

    expect($user->tokens()->count())->toBe(0);
});
