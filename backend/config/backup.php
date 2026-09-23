<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Sauvegardes de la base de données
    |--------------------------------------------------------------------------
    |
    | Dumps MySQL compressés (gzip) créés par `php artisan backup:run` ou depuis
    | Configuration → Sauvegardes. mysqldump est utilisé s'il est disponible,
    | sinon un dump 100 % PHP (PDO) prend le relais — pratique en mutualisé.
    |
    */

    // Disque Laravel (config/filesystems.php) et dossier de stockage.
    'disk' => env('BACKUP_DISK', 'local'),
    'path' => env('BACKUP_PATH', 'backups'),

    // Nombre de sauvegardes conservées (les plus anciennes sont supprimées).
    'keep' => (int) env('BACKUP_KEEP', 14),

    // Chemin du binaire mysqldump (auto-détecté sous WAMP si vide).
    'mysqldump' => env('BACKUP_MYSQLDUMP'),

    // Tables transitoires exclues des données (structure conservée).
    'skip_tables' => [
        'telescope_entries', 'telescope_entries_tags', 'telescope_monitoring',
        'sessions', 'cache', 'cache_locks', 'jobs', 'job_batches', 'failed_jobs',
        'password_reset_tokens',
    ],

];
