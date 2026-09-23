<?php

namespace App\Services;

use Illuminate\Contracts\Filesystem\Filesystem;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use PDO;
use RuntimeException;
use Symfony\Component\Process\Process;

/**
 * Sauvegarde de la base de données : dump MySQL compressé (gzip), stocké sur
 * un disque Laravel, avec rotation des anciennes sauvegardes (config/backup.php).
 */
class BackupService
{
    private function disk(): Filesystem
    {
        return Storage::disk((string) config('backup.disk', 'local'));
    }

    private function dir(): string
    {
        return trim((string) config('backup.path', 'backups'), '/');
    }

    /**
     * @return list<string>
     */
    private function skipTables(): array
    {
        return (array) config('backup.skip_tables', []);
    }

    /**
     * Liste des sauvegardes, de la plus récente à la plus ancienne.
     *
     * @return list<array{name: string, size: int, created_at: string}>
     */
    public function list(): array
    {
        $backups = [];
        foreach ($this->disk()->files($this->dir()) as $file) {
            if (! str_ends_with($file, '.sql.gz')) {
                continue;
            }
            $backups[] = [
                'name' => basename($file),
                'size' => $this->disk()->size($file),
                'created_at' => date('c', $this->disk()->lastModified($file)),
            ];
        }
        usort($backups, fn ($a, $b) => strcmp($b['name'], $a['name']));

        return $backups;
    }

    /** Crée une sauvegarde compressée et renvoie son nom de fichier. */
    public function run(): string
    {
        $driver = (string) config('database.connections.'.config('database.default').'.driver');
        if (! in_array($driver, ['mysql', 'mariadb'], true)) {
            throw new RuntimeException("Seules les bases MySQL/MariaDB sont prises en charge (connexion « {$driver} »).");
        }

        $db = (array) config('database.connections.'.config('database.default'));
        $name = $this->dir().'/backup-'.now()->format('Y-m-d_His').'.sql.gz';

        // mysqldump si disponible ; sinon (binaire absent, hébergement mutualisé…)
        // repli sur un dump PDO 100 % PHP.
        $sql = $this->dumpWithMysqldump($db);
        if ($sql !== null) {
            // + structure (sans données) des tables exclues : une restauration
            // sur un autre serveur doit retrouver sessions/cache/jobs.
            $this->disk()->put($name, (string) gzencode($sql.$this->skippedTablesStructure(), 6));
        } else {
            $tmp = tempnam(sys_get_temp_dir(), 'backup');
            try {
                $this->dumpViaPdoToGz($tmp);
                $this->disk()->put($name, (string) file_get_contents($tmp));
            } finally {
                @unlink($tmp);
            }
        }

        $this->rotate((int) config('backup.keep', 14));

        return basename($name);
    }

    /**
     * Dump via le binaire mysqldump. Renvoie le SQL, ou null si indisponible.
     *
     * @param  array<string, mixed>  $db
     */
    private function dumpWithMysqldump(array $db): ?string
    {
        try {
            $database = (string) ($db['database'] ?? '');
            $args = [
                $this->mysqldumpBinary(),
                '--host='.($db['host'] ?? '127.0.0.1'),
                '--port='.($db['port'] ?? 3306),
                '--user='.($db['username'] ?? 'root'),
                '--single-transaction',
                '--skip-lock-tables',
                '--default-character-set=utf8mb4',
            ];
            foreach ($this->skipTables() as $table) {
                $args[] = '--ignore-table='.$database.'.'.$table;
            }
            $args[] = $database;

            $process = new Process($args, null, ['MYSQL_PWD' => (string) ($db['password'] ?? '')]);
            $process->setTimeout(600);
            $process->run();

            return $process->isSuccessful() ? $process->getOutput() : null;
        } catch (\Throwable) {
            return null;
        }
    }

    /**
     * Dump 100 % PHP via la connexion PDO de l'application : écrit le .gz en
     * flux, ligne par ligne → mémoire faible même sur de grandes tables.
     */
    private function dumpViaPdoToGz(string $file): void
    {
        /** @var PDO $pdo */
        $pdo = DB::connection()->getPdo();
        $pdo->setAttribute(PDO::MYSQL_ATTR_USE_BUFFERED_QUERY, false);

        $gz = gzopen($file, 'wb6');
        try {
            gzwrite($gz, '-- Sauvegarde '.config('app.name').' (dump PDO) — '.now()->toDateTimeString()."\n"
                ."SET NAMES utf8mb4;\nSET FOREIGN_KEY_CHECKS=0;\n\n");

            foreach ($pdo->query('SHOW TABLES')->fetchAll(PDO::FETCH_COLUMN) as $table) {
                $create = $pdo->query('SHOW CREATE TABLE `'.$table.'`')->fetchAll(PDO::FETCH_NUM);
                gzwrite($gz, "DROP TABLE IF EXISTS `{$table}`;\n".$create[0][1].";\n\n");
                if (in_array($table, $this->skipTables(), true)) {
                    continue;
                }

                $stmt = $pdo->query('SELECT * FROM `'.$table.'`');
                while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
                    $cols = '`'.implode('`, `', array_keys($row)).'`';
                    $vals = implode(', ', array_map(
                        fn ($v) => $v === null ? 'NULL' : $pdo->quote((string) $v),
                        array_values($row),
                    ));
                    gzwrite($gz, "INSERT INTO `{$table}` ({$cols}) VALUES ({$vals});\n");
                }
                gzwrite($gz, "\n");
            }
            gzwrite($gz, "SET FOREIGN_KEY_CHECKS=1;\n");
        } finally {
            gzclose($gz);
            $pdo->setAttribute(PDO::MYSQL_ATTR_USE_BUFFERED_QUERY, true);
        }
    }

    /** DROP/CREATE des tables exclues du dump (structure sans données). */
    private function skippedTablesStructure(): string
    {
        $pdo = DB::connection()->getPdo();
        $existing = $pdo->query('SHOW TABLES')->fetchAll(PDO::FETCH_COLUMN);
        $sql = "\n-- Tables exclues des données (structure seulement)\n";
        foreach ($this->skipTables() as $table) {
            if (! in_array($table, $existing, true)) {
                continue;
            }
            $create = $pdo->query('SHOW CREATE TABLE `'.$table.'`')->fetchAll(PDO::FETCH_NUM);
            $sql .= "DROP TABLE IF EXISTS `{$table}`;\n".$create[0][1].";\n\n";
        }

        return $sql;
    }

    /** Supprime les sauvegardes au-delà des N plus récentes. Renvoie le nombre supprimé. */
    public function rotate(int $keep): int
    {
        $files = collect($this->disk()->files($this->dir()))
            ->filter(fn ($f) => str_ends_with($f, '.sql.gz'))
            ->sortDesc()
            ->values();

        $deleted = 0;
        foreach ($files->slice(max($keep, 1)) as $file) {
            $this->disk()->delete($file);
            $deleted++;
        }

        return $deleted;
    }

    /** Chemin absolu d'une sauvegarde (pour téléchargement), ou null si absente. */
    public function pathFor(string $name): ?string
    {
        $path = $this->dir().'/'.basename($name);

        return $this->disk()->exists($path) ? $this->disk()->path($path) : null;
    }

    /** Supprime une sauvegarde. Renvoie false si elle n'existe pas. */
    public function delete(string $name): bool
    {
        $path = $this->dir().'/'.basename($name);
        if (! str_ends_with($path, '.sql.gz') || ! $this->disk()->exists($path)) {
            return false;
        }

        return $this->disk()->delete($path);
    }

    /** Localise le binaire mysqldump (config, sinon auto-détection WAMP, sinon PATH). */
    private function mysqldumpBinary(): string
    {
        $configured = (string) config('backup.mysqldump');
        if ($configured !== '' && is_file($configured)) {
            return $configured;
        }

        foreach (['D:/wamp64/bin/mysql/*/bin/mysqldump.exe', 'D:/wamp64/bin/mariadb/*/bin/mysqldump.exe'] as $pattern) {
            foreach (glob($pattern) ?: [] as $candidate) {
                return $candidate;
            }
        }

        return 'mysqldump';
    }
}
