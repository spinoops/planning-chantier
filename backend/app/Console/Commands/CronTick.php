<?php

namespace App\Console\Commands;

use App\Services\BackupService;
use Illuminate\Console\Command;
use Throwable;

/**
 * Tâche périodique pour un hébergement sans crontab (Infomaniak mutualisé : le
 * planificateur appelle une URL, voir CronController). À chaque appel :
 *   1. rappels push « Dans 1 h : chantier X » (planning:remind avec une tolérance
 *      couvrant l'intervalle entre deux appels) ;
 *   2. sauvegarde de la base si la dernière a plus de 20 h ;
 *   3. ménage des connexions expirées.
 * Peu importe l'heure ou la fréquence exacte des appels.
 */
class CronTick extends Command
{
    protected $signature = 'planning:cron {--grace= : Tolérance des rappels en minutes (défaut : CRON_REMIND_GRACE ou 20)}';

    protected $description = 'Rappels push, sauvegarde quotidienne et ménage (appelé par le planificateur d\'URL).';

    public function handle(BackupService $backups): int
    {
        $ok = true;
        $grace = (int) ($this->option('grace') ?: config('planning.cron_remind_grace', 20));

        try {
            // $this->call (et non Artisan::call) : la sortie reste celle de cette commande,
            // que CronController renvoie au planificateur.
            $this->line('Rappels :');
            $this->call('planning:remind', ['--grace' => $grace]);
        } catch (Throwable $e) {
            report($e);
            $this->error('Rappels en échec : '.$e->getMessage());
            $ok = false;
        }

        try {
            $last = $backups->list()[0]['created_at'] ?? null;
            if ($last === null || now()->diffInHours($last, true) >= 20) {
                $this->line('Sauvegarde : '.$backups->run());
            } else {
                $this->line('Sauvegarde : la dernière date de moins de 20 h.');
            }
        } catch (Throwable $e) {
            report($e);
            $this->error('Sauvegarde en échec : '.$e->getMessage());
            $ok = false;
        }

        try {
            $this->callSilently('sanctum:prune-expired', ['--hours' => 24]);
        } catch (Throwable $e) {
            report($e);
        }

        return $ok ? self::SUCCESS : self::FAILURE;
    }
}
