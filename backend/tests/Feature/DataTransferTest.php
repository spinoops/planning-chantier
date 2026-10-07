<?php

use App\Models\Affectation;
use App\Models\Chantier;
use App\Models\Client;
use App\Models\TimeEntry;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

beforeEach(fn () => ensureRoles());

it('reprend les données exportées dans une autre base (comptes, clients, planning)', function () {
    $robin = User::factory()->create(['email' => 'robin@top-stores.ch', 'password' => Hash::make('Test1234$')]);
    $robin->assignRole(['admin', 'chef']);
    $client = Client::create(['name' => 'Joray François', 'city' => 'Porrentruy', 'notes' => "Ligne 1\nL'accès par la cour"]);
    $chantier = Chantier::create(['name' => 'Joray François – Garage', 'client' => $client->name, 'client_id' => $client->id, 'color' => '#e30917', 'status' => 'active']);
    $a = Affectation::create(['chantier_id' => $chantier->id, 'date' => '2026-10-12', 'start_time' => '07:30', 'end_time' => '12:00']);
    $a->syncPeople([$robin->id], []);
    TimeEntry::create(['user_id' => $robin->id, 'date' => '2026-10-05', 'start_time' => '07:30', 'end_time' => '12:00', 'break_minutes' => 0, 'status' => 'draft']);
    $robin->createToken('ancien-appareil');

    $file = storage_path('app/transfer/test-transfert.sql');
    $this->artisan('planning:export-data', ['--output' => $file])->assertSuccessful();

    // La base « de production » a autre chose : tout doit être remplacé.
    DB::table('affectation_user')->delete();
    Affectation::query()->delete();
    Chantier::query()->forceDelete();
    Client::query()->forceDelete();
    User::query()->forceDelete();
    User::factory()->create(['email' => 'ancien@exemple.ch']);

    $this->artisan('planning:import-data', ['file' => $file, '--force' => true, '--no-backup' => true])->assertSuccessful();

    expect(User::pluck('email')->all())->toBe(['robin@top-stores.ch'])
        ->and(Hash::check('Test1234$', User::first()->password))->toBeTrue()
        ->and(User::first()->getRoleNames()->sort()->values()->all())->toBe(['admin', 'chef'])
        ->and(Client::first()->notes)->toBe("Ligne 1\nL'accès par la cour")
        ->and(Chantier::first()->client_id)->toBe(Client::first()->id)
        ->and(Affectation::first()->workers()->pluck('users.id')->all())->toBe([User::first()->id])
        // Sans --with-heures : pas d'heures, et plus aucune ancienne connexion.
        ->and(TimeEntry::count())->toBe(0)
        ->and(DB::table('personal_access_tokens')->count())->toBe(0);

    @unlink($file);
});

it('refuse un fichier introuvable', function () {
    $this->artisan('planning:import-data', ['file' => 'inexistant.sql', '--force' => true])->assertFailed();
});
