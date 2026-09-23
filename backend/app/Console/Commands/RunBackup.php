<?php

namespace App\Console\Commands;

use App\Services\BackupService;
use Illuminate\Console\Command;
use Throwable;

class RunBackup extends Command
{
    protected $signature = 'backup:run';

    protected $description = 'Sauvegarde la base de données (dump compressé, avec rotation).';

    public function handle(BackupService $service): int
    {
        try {
            $name = $service->run();
            $this->info("Sauvegarde créée : {$name}");

            return self::SUCCESS;
        } catch (Throwable $e) {
            $this->error($e->getMessage());

            return self::FAILURE;
        }
    }
}
