<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Tâche planifiée par URL (hébergement sans crontab)
    |--------------------------------------------------------------------------
    |
    | Le planificateur d'Infomaniak appelle GET /api/cron/run/{CRON_TOKEN}. Sans jeton,
    | l'adresse est désactivée (404). La tolérance des rappels (minutes) doit couvrir
    | l'intervalle entre deux appels : 20 convient pour un appel toutes les 5 à 15 min.
    |
    */

    'cron_token' => env('CRON_TOKEN', ''),

    'cron_remind_grace' => (int) env('CRON_REMIND_GRACE', 20),

];
