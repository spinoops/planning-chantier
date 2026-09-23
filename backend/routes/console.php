<?php

use App\Support\Modules;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

/*
|--------------------------------------------------------------------------
| Tâches planifiées
|--------------------------------------------------------------------------
|
| Nécessite un cron `php artisan schedule:run` chaque minute (voir DEPLOY.md).
| Sauvegarde quotidienne de la base si le module « Sauvegardes » est actif.
|
*/

Schedule::command('backup:run')
    ->dailyAt('03:00')
    ->when(fn () => Modules::isEnabled('backups'));
