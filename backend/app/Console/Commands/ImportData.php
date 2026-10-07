<?php

namespace App\Console\Commands;

use App\Services\BackupService;
use App\Support\DataTransfer;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Throwable;

/**
 * En production : remplace les données métier par celles d'un fichier produit par
 * planning:export-data (sauvegarde de la base d'abord). Les tables reprises sont
 * vidées puis remplies ; connexions et abonnements push sont réinitialisés (chacun
 * se reconnecte et réactive ses alertes).
 *
 *   php artisan planning:import-data donnees-20261007-180000.sql
 *       (fichier déposé dans backend/storage/app/transfer/, ou chemin complet)
 */
class ImportData extends Command
{
    protected $signature = 'planning:import-data
                            {file : Fichier exporté (nom dans storage/app/transfer ou chemin)}
                            {--force : Ne pas demander de confirmation}
                            {--no-backup : Ne pas sauvegarder la base avant (déconseillé)}';

    protected $description = 'Remplace les données métier par celles exportées en local (sauvegarde d\'abord).';

    public function handle(BackupService $backups): int
    {
        $file = (string) $this->argument('file');
        $path = collect([$file, storage_path('app/transfer/'.$file), base_path($file)])->first(fn ($p) => is_file($p));
        if (! $path) {
            $this->error("Fichier introuvable : {$file} (dépose-le dans backend/storage/app/transfer/).");

            return self::FAILURE;
        }

        $statements = array_values(array_filter(
            array_map('trim', explode(DataTransfer::SEPARATOR, (string) file_get_contents($path))),
            fn (string $s) => $s !== '' && ! str_starts_with($s, '--'),
        ));
        if ($statements === []) {
            $this->error('Fichier vide ou illisible.');

            return self::FAILURE;
        }

        $this->warn('Les comptes, réglages, équipes, clients, chantiers, planning et absences actuels vont être REMPLACÉS.');
        if (! $this->option('force') && ! $this->confirm('Continuer ?', false)) {
            $this->line('Annulé.');

            return self::FAILURE;
        }

        if (! $this->option('no-backup')) {
            try {
                $this->info('Sauvegarde : '.$backups->run());
            } catch (Throwable $e) {
                $this->error('Sauvegarde impossible, import annulé : '.$e->getMessage());

                return self::FAILURE;
            }
        }

        Schema::disableForeignKeyConstraints();
        try {
            foreach (DataTransfer::ALWAYS_CLEARED as $table) {
                if (Schema::hasTable($table)) {
                    DB::table($table)->delete();
                }
            }
            foreach ($statements as $sql) {
                DB::unprepared($sql);
            }
        } catch (Throwable $e) {
            $this->error('Import interrompu : '.$e->getMessage());
            $this->error('La base est peut-être incomplète : restaurer la sauvegarde ci-dessus (DEPLOY.md, § 4).');

            return self::FAILURE;
        } finally {
            Schema::enableForeignKeyConstraints();
        }

        Artisan::call('permission:cache-reset');
        Artisan::call('cache:clear');

        $counts = collect(['users', 'clients', 'chantiers', 'affectations', 'equipes', 'absences', 'time_entries'])
            ->filter(fn ($t) => Schema::hasTable($t))
            ->map(fn ($t) => [$t, DB::table($t)->count()])
            ->values()
            ->all();
        $this->table(['Table', 'Lignes'], $counts);
        $this->info('Import terminé. Supprime maintenant le fichier : rm '.$path);

        return self::SUCCESS;
    }
}
