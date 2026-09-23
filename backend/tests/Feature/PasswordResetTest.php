<?php

use App\Models\User;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Password;

it('envoie une notification de réinitialisation', function () {
    Notification::fake();
    $user = User::factory()->create(['email' => 'reset@example.com']);

    $this->postJson('/api/forgot-password', ['email' => 'reset@example.com'])->assertOk();

    Notification::assertSentTo($user, ResetPassword::class);
});

it('réinitialise le mot de passe avec un token valide', function () {
    $user = User::factory()->create(['email' => 'reset@example.com']);
    $token = Password::createToken($user);

    $this->postJson('/api/reset-password', [
        'token' => $token,
        'email' => 'reset@example.com',
        'password' => 'nouveaupass123',
        'password_confirmation' => 'nouveaupass123',
    ])->assertOk();

    expect(Hash::check('nouveaupass123', $user->fresh()->password))->toBeTrue();
});

it('rejette un token de réinitialisation invalide (422)', function () {
    User::factory()->create(['email' => 'reset@example.com']);

    $this->postJson('/api/reset-password', [
        'token' => 'invalide',
        'email' => 'reset@example.com',
        'password' => 'nouveaupass123',
        'password_confirmation' => 'nouveaupass123',
    ])->assertStatus(422);
});
