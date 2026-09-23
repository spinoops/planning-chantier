<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Configuration CORS
    |--------------------------------------------------------------------------
    |
    | Autorise la SPA React (Vite) à appeler l'API. Avec une authentification
    | par token Bearer, supports_credentials peut rester à false.
    | Si tu passes un jour en mode cookie/session Sanctum, mets-le à true.
    |
    */

    'paths' => ['api/*', 'sanctum/csrf-cookie'],

    'allowed_methods' => ['*'],

    'allowed_origins' => [
        env('FRONTEND_URL', 'http://localhost:5173'),
    ],

    'allowed_origins_patterns' => [],

    'allowed_headers' => ['*'],

    'exposed_headers' => [],

    'max_age' => 0,

    'supports_credentials' => false,

];
