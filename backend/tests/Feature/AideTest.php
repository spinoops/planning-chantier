<?php

beforeEach(fn () => ensureRoles());

it('réserve le mode d’emploi aux personnes connectées', function () {
    $this->getJson('/api/aide')->assertUnauthorized();
    $this->get('/api/aide/images/01-connexion.webp')->assertUnauthorized();
});

it('renvoie le texte et les captures du mode d’emploi à un employé connecté', function () {
    actingAsUser();

    $blocks = $this->getJson('/api/aide')->assertOk()->json('data');
    $images = collect($blocks)->where('t', 'img')->pluck('src');

    expect(collect($blocks)->where('t', 'h1')->pluck('text')->all())->toContain('Connexion', 'Planning')
        ->and($images)->not->toBeEmpty();

    $this->get('/api/aide/images/'.$images->first())
        ->assertOk()
        ->assertHeader('Content-Type', 'image/webp');

    // Aucune donnée sensible dans un contenu lu par tous les employés.
    expect(json_encode($blocks))->not->toContain('Test1234');
});

it('refuse un nom de capture inconnu ou mal formé', function () {
    actingAsUser();

    $this->get('/api/aide/images/inconnue.webp')->assertNotFound();
    $this->get('/api/aide/images/..%2F..%2F.env')->assertNotFound();
    $this->get('/api/aide/images/aide.json')->assertNotFound();
});
