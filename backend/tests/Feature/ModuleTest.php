<?php

use App\Support\Modules;

it('expose l\'état des modules dans les réglages publics', function () {
    $this->getJson('/api/settings')
        ->assertOk()
        ->assertJsonPath('modules.invitations', true)
        ->assertJsonPath('modules.backups', true)
        ->assertJsonStructure(['features' => ['invitations_for_everyone']]);
});

it('liste les modules avec leurs métadonnées (admin)', function () {
    actingAsAdmin();

    $this->getJson('/api/modules')
        ->assertOk()
        ->assertJsonStructure(['data' => [['key', 'name', 'description', 'available', 'enabled']]])
        ->assertJsonFragment(['key' => 'invitations', 'enabled' => true]);
});

it('permet à un admin d\'activer/désactiver un module', function () {
    actingAsAdmin();

    $this->putJson('/api/modules', ['modules' => ['invitations' => false, 'inconnu' => true]])
        ->assertOk()
        ->assertJsonFragment(['key' => 'invitations', 'enabled' => false]);

    expect(Modules::isEnabled('invitations'))->toBeFalse()
        ->and(Modules::isEnabled('backups'))->toBeTrue();

    $this->assertDatabaseHas('settings', ['key' => 'module.invitations', 'value' => '0']);
    $this->assertDatabaseMissing('settings', ['key' => 'module.inconnu']);
});

it('n\'expose pas les clés techniques module.* dans les réglages', function () {
    Modules::setMany(['invitations' => false]);

    $settings = $this->getJson('/api/settings')->assertOk()->json();

    expect($settings)->not->toHaveKey('module.invitations')
        ->and($settings['modules']['invitations'])->toBeFalse();
});

it('interdit la gestion des modules à un non-admin', function () {
    actingAsUser();

    $this->getJson('/api/modules')->assertForbidden();
    $this->putJson('/api/modules', ['modules' => ['invitations' => false]])->assertForbidden();
});
