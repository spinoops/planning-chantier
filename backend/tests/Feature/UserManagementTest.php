<?php

use App\Models\User;

it('interdit la liste des utilisateurs à un non-admin', function () {
    actingAsUser();

    $this->getJson('/api/users')->assertForbidden();
});

it('permet à un admin de lister les utilisateurs (paginé)', function () {
    actingAsAdmin();

    $this->getJson('/api/users')
        ->assertOk()
        ->assertJsonStructure([
            'data' => [['id', 'name', 'email', 'roles', 'permissions']],
            'meta',
            'links',
        ]);
});

it('filtre les utilisateurs par recherche, rôle et tri', function () {
    actingAsAdmin(['name' => 'Zoé Admin']);
    $alice = User::factory()->create(['name' => 'Alice', 'email' => 'alice@example.com']);
    $alice->assignRole('ouvrier');
    $bob = User::factory()->create(['name' => 'Bob', 'email' => 'bob@example.com']);
    $bob->assignRole('ouvrier');

    $this->getJson('/api/users?search=alice')
        ->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.email', 'alice@example.com');

    $this->getJson('/api/users?role=admin')
        ->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.name', 'Zoé Admin');

    $this->getJson('/api/users?sort=name&dir=asc&per_page=2')
        ->assertOk()
        ->assertJsonCount(2, 'data')
        ->assertJsonPath('data.0.name', 'Alice')
        ->assertJsonPath('meta.per_page', 2);
});

it('rejette un paramètre de tri inconnu (422)', function () {
    actingAsAdmin();

    $this->getJson('/api/users?sort=password')->assertStatus(422);
});

it('affiche le détail d\'un utilisateur', function () {
    actingAsAdmin();
    $other = User::factory()->create();

    $this->getJson("/api/users/{$other->id}")
        ->assertOk()
        ->assertJsonPath('data.id', $other->id);
});

it('permet à un admin de créer un utilisateur avec un rôle', function () {
    actingAsAdmin();

    $this->postJson('/api/users', [
        'name' => 'Nouveau',
        'email' => 'nouveau@example.com',
        'password' => 'secret123',
        'roles' => ['ouvrier'],
    ])
        ->assertCreated()
        ->assertJsonPath('data.roles', ['ouvrier']);

    $this->assertDatabaseHas('users', ['email' => 'nouveau@example.com']);
});

it('valide les données à la création (422)', function () {
    actingAsAdmin();

    $this->postJson('/api/users', [
        'name' => '',
        'email' => 'invalide',
        'password' => '123',
        'roles' => [],
    ])->assertStatus(422);
});

it('empêche un admin de se retirer son propre rôle admin', function () {
    $admin = actingAsAdmin();

    $this->putJson("/api/users/{$admin->id}", [
        'name' => $admin->name,
        'email' => $admin->email,
        'roles' => ['ouvrier'],
    ])->assertStatus(422);

    expect($admin->fresh()->hasRole('admin'))->toBeTrue();
});

it('révoque les tokens d\'un utilisateur dont le mot de passe est imposé', function () {
    actingAsAdmin();
    $other = User::factory()->create();
    $other->assignRole('ouvrier');
    $other->createToken('phone');

    $this->putJson("/api/users/{$other->id}", [
        'name' => $other->name,
        'email' => $other->email,
        'password' => 'nouveau-secret',
        'roles' => ['ouvrier'],
    ])->assertOk();

    expect($other->tokens()->count())->toBe(0);
});

it('empêche un admin de supprimer son propre compte', function () {
    $admin = actingAsAdmin();

    $this->deleteJson("/api/users/{$admin->id}")->assertStatus(422);
});

it('supprime un autre utilisateur en soft delete et l\'exclut des listes', function () {
    actingAsAdmin();
    $other = User::factory()->create();
    $other->createToken('phone');

    $this->deleteJson("/api/users/{$other->id}")->assertOk();

    // Soft delete : la ligne existe encore avec deleted_at renseigné...
    $this->assertSoftDeleted('users', ['id' => $other->id]);
    // ...ses tokens sont révoqués...
    expect($other->tokens()->count())->toBe(0);

    // ...et l'utilisateur n'apparaît plus dans la liste.
    $this->getJson('/api/users')
        ->assertOk()
        ->assertJsonMissing(['email' => $other->email]);
});

it('liste la corbeille et restaure un utilisateur supprimé', function () {
    actingAsAdmin();
    $other = User::factory()->create();
    $other->delete();

    $this->getJson('/api/users?trashed=1')
        ->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.id', $other->id)
        ->assertJsonStructure(['data' => [['deleted_at']]]);

    $this->postJson("/api/users/{$other->id}/restore")
        ->assertOk()
        ->assertJsonPath('data.id', $other->id);

    $this->assertNotSoftDeleted('users', ['id' => $other->id]);
});

it('refuse de restaurer un utilisateur non supprimé (422)', function () {
    actingAsAdmin();
    $other = User::factory()->create();

    $this->postJson("/api/users/{$other->id}/restore")->assertStatus(422);
});

it('journalise la création d\'un utilisateur (activity log)', function () {
    actingAsAdmin();

    $id = $this->postJson('/api/users', [
        'name' => 'Journalisé',
        'email' => 'journal@example.com',
        'password' => 'secret123',
        'roles' => ['ouvrier'],
    ])->assertCreated()->json('data.id');

    $this->assertDatabaseHas('activity_log', [
        'subject_type' => User::class,
        'subject_id' => $id,
        'event' => 'created',
    ]);
});

it('expose la liste des rôles avec leurs libellés (admin)', function () {
    actingAsAdmin();

    $this->getJson('/api/roles')
        ->assertOk()
        ->assertJsonPath('default', 'ouvrier')
        ->assertJsonFragment(['name' => 'admin', 'label' => 'Administrateur'])
        ->assertJsonFragment(['name' => 'ouvrier', 'label' => 'Ouvrier']);
});

it('interdit la liste des rôles à un non-admin', function () {
    actingAsUser();

    $this->getJson('/api/roles')->assertForbidden();
});
