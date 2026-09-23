<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Qui peut inviter ?
    |--------------------------------------------------------------------------
    |
    | 'admin'    : seuls les administrateurs émettent des invitations (défaut).
    | 'everyone' : tout utilisateur connecté peut inviter (un non-admin ne
    |              peut toutefois attribuer que le rôle par défaut).
    |
    */

    'who_can_invite' => env('INVITATION_WHO_CAN_INVITE', 'admin'),

    /*
    |--------------------------------------------------------------------------
    | Durée de validité d'une invitation (jours)
    |--------------------------------------------------------------------------
    */

    'expires_days' => (int) env('INVITATION_EXPIRES_DAYS', 7),

    /*
    |--------------------------------------------------------------------------
    | Quota d'invitations en attente par utilisateur non-admin (anti-abus)
    |--------------------------------------------------------------------------
    */

    'max_pending_per_user' => (int) env('INVITATION_MAX_PENDING', 20),

];
