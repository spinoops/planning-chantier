<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Modules optionnels
    |--------------------------------------------------------------------------
    |
    | Fonctions que l'administrateur peut activer/désactiver depuis la page
    | Configuration (état stocké dans la table `settings`, clé `module.<clé>`).
    |
    |   - name / description : affichés dans l'interface d'administration.
    |   - default            : état initial tant que l'admin n'a rien changé.
    |   - available          : false pour masquer un module en préparation.
    |
    | Côté API, protège les routes d'un module avec le middleware `module:<clé>`.
    | Côté front, `ModuleGate` et `lib/navigation.ts` masquent pages et menus.
    | Ajoute ici les modules métier de ton projet dérivé.
    |
    */

    'invitations' => [
        'name' => 'Invitations',
        'description' => 'Créer des comptes en envoyant un lien d\'inscription par email.',
        'default' => true,
    ],

    'backups' => [
        'name' => 'Sauvegardes',
        'description' => 'Sauvegarder la base de données depuis l\'interface (dump compressé, rotation).',
        'default' => true,
    ],

];
