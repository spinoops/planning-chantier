<?php

use App\Models\User;
use Illuminate\Support\Facades\Hash;

it('expose un endpoint health public', function () {
    $this->getJson('/api/health')
        ->assertOk()
        ->assertJson(['status' => 'ok']);
});

it('connecte un utilisateur et renvoie un token', function () {
    User::factory()->create([
        'email' => 'jane@example.com',
        'password' => Hash::make('secret123'),
    ]);

    $response = $this->postJson('/api/login', [
        'email' => 'jane@example.com',
        'password' => 'secret123',
    ]);

    $response->assertOk()
        ->assertJsonStructure(['token', 'user' => ['id', 'name', 'email']]);

    expect($response->json('user.email'))->toBe('jane@example.com');
});

it('refuse des identifiants invalides', function () {
    User::factory()->create([
        'email' => 'jane@example.com',
        'password' => Hash::make('secret123'),
    ]);

    $this->postJson('/api/login', [
        'email' => 'jane@example.com',
        'password' => 'mauvais-mot-de-passe',
    ])->assertStatus(422);
});

it('renvoie l\'utilisateur authentifie via son token', function () {
    $user = User::factory()->create();
    $token = $user->createToken('test')->plainTextToken;

    $this->withToken($token)
        ->getJson('/api/user')
        ->assertOk()
        ->assertJson(['email' => $user->email]);
});

it('bloque /api/user sans token', function () {
    $this->getJson('/api/user')->assertUnauthorized();
});

it('renvoie 401 JSON meme sans en-tete Accept', function () {
    // Sans Accept: application/json, Laravel tenterait sinon une redirection -> 500.
    $this->get('/api/user', ['Authorization' => 'Bearer token-invalide'])
        ->assertUnauthorized();
});

it('deconnecte en revoquant le token courant', function () {
    $user = User::factory()->create();
    $token = $user->createToken('test')->plainTextToken;

    $this->withToken($token)->postJson('/api/logout')->assertOk();

    expect($user->fresh()->tokens()->count())->toBe(0);
});
