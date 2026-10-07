<?php

use App\Services\BackupService;
use Illuminate\Support\Facades\Storage;

beforeEach(function () {
    Storage::fake('local');
    config(['backup.disk' => 'local', 'backup.path' => 'backups', 'backup.keep' => 2]);
});

it('liste les sauvegardes existantes, de la plus récente à la plus ancienne (admin)', function () {
    actingAsAdmin();
    Storage::disk('local')->put('backups/backup-2026-01-01_000000.sql.gz', 'a');
    Storage::disk('local')->put('backups/backup-2026-02-01_000000.sql.gz', 'b');
    Storage::disk('local')->put('backups/notes.txt', 'ignoré');

    $this->getJson('/api/backups')
        ->assertOk()
        ->assertJsonCount(2, 'data')
        ->assertJsonPath('data.0.name', 'backup-2026-02-01_000000.sql.gz')
        ->assertJsonStructure(['data' => [['name', 'size', 'created_at']]]);
});

it('télécharge et supprime une sauvegarde (admin)', function () {
    actingAsAdmin();
    Storage::disk('local')->put('backups/backup-2026-01-01_000000.sql.gz', 'contenu');

    $this->get('/api/backups/backup-2026-01-01_000000.sql.gz/download')
        ->assertOk()
        ->assertDownload('backup-2026-01-01_000000.sql.gz');

    $this->deleteJson('/api/backups/backup-2026-01-01_000000.sql.gz')->assertOk();
    Storage::disk('local')->assertMissing('backups/backup-2026-01-01_000000.sql.gz');

    $this->deleteJson('/api/backups/inexistante.sql.gz')->assertNotFound();
});

it('refuse de sauvegarder une base autre que MySQL (422)', function () {
    actingAsAdmin();

    // Les tests tournent sur SQLite : le service doit l'expliquer, pas planter.
    $this->postJson('/api/backups')->assertStatus(422)->assertJsonStructure(['message']);
})->skip(fn () => in_array(config('database.connections.'.config('database.default').'.driver'), ['mysql', 'mariadb'], true), 'Vérifie le refus hors MySQL : sans objet quand la CI tourne sur MySQL.');

it('applique la rotation en ne gardant que les N plus récentes', function () {
    foreach (['01', '02', '03', '04'] as $month) {
        Storage::disk('local')->put("backups/backup-2026-{$month}-01_000000.sql.gz", $month);
    }

    $deleted = app(BackupService::class)->rotate(2);

    expect($deleted)->toBe(2)
        ->and(app(BackupService::class)->list())->toHaveCount(2);
    Storage::disk('local')->assertMissing('backups/backup-2026-01-01_000000.sql.gz');
    Storage::disk('local')->assertExists('backups/backup-2026-04-01_000000.sql.gz');
});

it('interdit les sauvegardes à un non-admin', function () {
    actingAsUser();

    $this->getJson('/api/backups')->assertForbidden();
});
