<?php

use App\Console\Commands\MakeStaff;
use App\Models\Equipe;
use App\Models\User;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;
use Spatie\Permission\Models\Role;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

it('ne crée que les rôles en production, sans compte de démo', function () {
    app()->detectEnvironment(fn () => 'production');

    // Appel direct : `db:seed` demanderait une confirmation en production.
    app(DatabaseSeeder::class)->setContainer(app())->__invoke();

    expect(Role::pluck('name')->sort()->values()->all())->toBe(['admin', 'chef', 'gestionnaire', 'ouvrier'])
        ->and(User::count())->toBe(0);
});

it('crée le premier admin et lui envoie le lien pour définir son mot de passe', function () {
    Notification::fake();

    $this->artisan('planning:admin', ['email' => 'Chef@Top-Store.ch', '--name' => 'Robin Braun', '--mail' => true])->assertSuccessful();

    $user = User::where('email', 'chef@top-store.ch')->firstOrFail();
    expect($user->name)->toBe('Robin Braun')
        ->and($user->hasRole('admin'))->toBeTrue();
    Notification::assertSentTo($user, ResetPassword::class);

    // Relancer sur un compte existant le promeut sans le dupliquer.
    $this->artisan('planning:admin', ['email' => 'chef@top-store.ch'])->assertSuccessful();
    expect(User::where('email', 'chef@top-store.ch')->count())->toBe(1);
});

it('refuse une adresse invalide pour le compte admin', function () {
    $this->artisan('planning:admin', ['email' => 'pas-une-adresse'])->assertFailed();
});

it('protège l\u2019URL de la tâche planifiée par le jeton CRON_TOKEN', function () {
    config(['planning.cron_token' => '']);
    $this->getJson('/api/cron/run/nimporte')->assertNotFound();

    config(['planning.cron_token' => 'secret-de-test']);
    $this->getJson('/api/cron/run/mauvais')->assertNotFound();
});

it('lance les rappels par l\u2019URL de la tâche planifiée', function () {
    config(['planning.cron_token' => 'secret-de-test']);

    $res = $this->getJson('/api/cron/run/secret-de-test');

    // La sauvegarde exige MySQL : en test (SQLite) elle échoue proprement, les rappels passent quand même.
    expect($res->json('output'))->toContain('Rappels :')
        ->and($res->status())->toBeIn([200, 500]);
});

it('sert l\u2019interface React pour toute adresse hors /api une fois le front copié', function () {
    $index = public_path('index.html');
    $existed = is_file($index);
    if (! $existed) {
        file_put_contents($index, '<!doctype html><title>Planning</title><div id="root"></div>');
    }

    try {
        $res = $this->get('/planning?view=week')->assertOk();
        expect($res->baseResponse)->toBeInstanceOf(BinaryFileResponse::class)
            ->and($res->baseResponse->getFile()->getPathname())->toBe($index);
        $this->getJson('/api/route-inexistante')->assertNotFound();
    } finally {
        if (! $existed) {
            unlink($index);
        }
    }
});

it('crée le compte admin avec le mot de passe standard, sans e-mail', function () {
    Notification::fake();

    $this->artisan('planning:admin', ['email' => 'login@step-one.ch', '--name' => 'Step One'])->assertSuccessful();

    $user = User::where('email', 'login@step-one.ch')->firstOrFail();
    expect(Hash::check(MakeStaff::DEFAULT_PASSWORD, $user->password))->toBeTrue()
        ->and($user->hasRole('admin'))->toBeTrue();
    Notification::assertNothingSent();
    $this->postJson('/api/login', ['email' => 'login@step-one.ch', 'password' => MakeStaff::DEFAULT_PASSWORD])->assertOk();
});

it('crée les cinq employés avec un mot de passe commun, sans doublon', function () {
    $this->artisan('planning:staff', ['--password' => 'court'])->assertFailed();
    $this->artisan('planning:staff')->assertSuccessful();
    $this->artisan('planning:staff')->assertSuccessful();

    expect(User::count())->toBe(5)
        ->and(Equipe::count())->toBe(5);
    $robin = User::where('email', 'robin@top-stores.ch')->firstOrFail();
    expect($robin->getRoleNames()->sort()->values()->all())->toBe(['admin', 'chef'])
        ->and($robin->equipe->name)->toBe('Robin')
        ->and(User::where('email', 'davison@top-stores.ch')->first()->hasRole('gestionnaire'))->toBeTrue();
    $this->postJson('/api/login', ['email' => 'leo@top-stores.ch', 'password' => MakeStaff::DEFAULT_PASSWORD])->assertOk();
});
