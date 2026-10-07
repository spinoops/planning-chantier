<?php

namespace App\Console\Commands;

use App\Support\DataTransfer;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * En local : exporte les données métier dans un fichier SQL à importer en production
 * avec planning:import-data. Le fichier contient les comptes (mots de passe chiffrés) :
 * le supprimer après l'import.
 *
 *   php artisan planning:export-data                 (sans les heures pointées)
 *   php artisan planning:export-data --with-heures   (avec)
 */
class ExportData extends Command
{
    protected $signature = 'planning:export-data
                            {--with-heures : Reprendre aussi les heures pointées}
                            {--output= : Chemin du fichier (défaut : storage/app/transfer/donnees-<date>.sql)}';

    protected $description = 'Exporte les données métier (comptes, clients, chantiers, planning…) pour les reprendre en production.';

    public function handle(): int
    {
        $pdo = DB::connection()->getPdo();
        $tables = DataTransfer::tables((bool) $this->option('with-heures'));
        $statements = [];
        $summary = [];

        foreach ($tables as $table) {
            if (! Schema::hasTable($table)) {
                continue;
            }
            $statements[] = 'DELETE FROM `'.$table.'`';
            $rows = DB::table($table)->get()->map(fn ($r) => (array) $r);
            $summary[] = [$table, $rows->count()];

            foreach ($rows->chunk(100) as $chunk) {
                $columns = array_keys($chunk->first());
                $values = $chunk->map(fn (array $row) => '('.implode(', ', array_map(
                    fn ($v) => $v === null ? 'NULL' : (is_bool($v) ? (int) $v : (is_int($v) || is_float($v) ? $v : $pdo->quote((string) $v))),
                    array_values($row),
                )).')')->implode(",\n");
                $statements[] = 'INSERT INTO `'.$table.'` (`'.implode('`, `', $columns).'`) VALUES'."\n".$values;
            }
        }

        $path = (string) ($this->option('output') ?: storage_path('app/transfer/donnees-'.now()->format('Ymd-His').'.sql'));
        if (! is_dir(dirname($path))) {
            mkdir(dirname($path), 0775, true);
        }
        $header = '-- Planning Chantier : données exportées le '.now()->format('d.m.Y H:i').' ('.config('app.env').")\n"
            .'-- À importer avec : php artisan planning:import-data '.basename($path)."\n";
        file_put_contents($path, $header.DataTransfer::SEPARATOR.implode(DataTransfer::SEPARATOR, $statements).DataTransfer::SEPARATOR);

        $this->table(['Table', 'Lignes'], $summary);
        $this->info('Fichier : '.$path);
        $this->comment('Il contient les comptes : le supprimer une fois importé.');

        return self::SUCCESS;
    }
}
