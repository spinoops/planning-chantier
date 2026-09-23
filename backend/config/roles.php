<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Rôles de l'application
    |--------------------------------------------------------------------------
    |
    | Clé = nom du rôle (spatie/laravel-permission), valeur = libellé affiché.
    |
    |   - admin   : administre tout (comptes, configuration) + planifie.
    |   - chef    : chef de chantier / planificateur : gère chantiers et planning.
    |   - ouvrier : consulte son planning personnel (tablette / téléphone).
    |
    */

    'labels' => [
        'admin' => 'Administrateur',
        'chef' => 'Chef de chantier',
        'ouvrier' => 'Ouvrier',
    ],

    /*
    |--------------------------------------------------------------------------
    | Rôle par défaut
    |--------------------------------------------------------------------------
    |
    | Attribué aux comptes créés par invitation quand aucun rôle n'est précisé.
    |
    */

    'default' => 'ouvrier',

    /*
    |--------------------------------------------------------------------------
    | Rôles planificateurs
    |--------------------------------------------------------------------------
    |
    | Rôles autorisés à créer/modifier les chantiers et les affectations.
    | Utilisés par le middleware `role:` des routes d'écriture du planning.
    |
    */

    'planners' => ['admin', 'chef'],

    /*
    |--------------------------------------------------------------------------
    | Rôles affectables
    |--------------------------------------------------------------------------
    |
    | Rôles qui peuvent être placés sur un chantier (liste « équipe »).
    |
    */

    'assignable' => ['ouvrier', 'chef'],

];
