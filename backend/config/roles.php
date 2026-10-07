<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Rôles de l'application
    |--------------------------------------------------------------------------
    |
    | Clé = nom du rôle (spatie/laravel-permission), valeur = libellé affiché.
    |
    |   - admin        : administre tout (comptes, rôles, configuration) + planifie.
    |   - gestionnaire : employé de bureau : prépare les chantiers (clients, devis, mesures),
    |                    planifie, suit et valide les heures, gère les absences.
    |   - chef         : chef de chantier / patron : planifie et passe sur les chantiers.
    |   - ouvrier      : consulte son planning personnel (tablette / téléphone), pointe ses heures.
    |
    | Un compte peut cumuler plusieurs rôles (ex. le patron : admin + chef).
    |
    */

    'labels' => [
        'admin' => 'Administrateur',
        'gestionnaire' => 'Gestionnaire',
        'chef' => 'Chef de chantier',
        'ouvrier' => 'Ouvrier',
    ],

    'descriptions' => [
        'admin' => 'Gère les comptes, les rôles et la configuration. Peut aussi tout planifier.',
        'gestionnaire' => 'Au bureau : prépare les chantiers, les clients et les devis, planifie, valide les heures et les absences.',
        'chef' => 'Sur le terrain : planifie, passe sur les chantiers, peut être affecté à une équipe.',
        'ouvrier' => 'Consulte son planning, pointe ses heures, signale les imprévus.',
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

    'planners' => ['admin', 'gestionnaire', 'chef'],

    /*
    |--------------------------------------------------------------------------
    | Rôles affectables
    |--------------------------------------------------------------------------
    |
    | Rôles qui peuvent être placés sur un chantier (liste « équipe »).
    |
    */

    'assignable' => ['ouvrier', 'chef', 'gestionnaire'],

];
