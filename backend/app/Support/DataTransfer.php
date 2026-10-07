<?php

namespace App\Support;

/**
 * Reprise des données métier d'une base vers une autre (local → production) :
 * comptes et rôles, réglages, équipes, clients, sous-traitants, chantiers, planning,
 * absences, imprévus et, sur demande, heures pointées.
 *
 * Jamais repris : connexions (jetons, sessions), abonnements push, liens de mot de
 * passe, invitations, journal d'activité, caches, files d'attente, Telescope, migrations.
 */
class DataTransfer
{
    /** Séparateur entre deux instructions SQL du fichier (les textes peuvent contenir des retours à la ligne). */
    public const SEPARATOR = "\n-- @@\n";

    /**
     * Tables reprises, parents avant enfants.
     *
     * @return list<string>
     */
    public static function tables(bool $withHours = false): array
    {
        return array_values(array_filter([
            'roles',
            'permissions',
            'role_has_permissions',
            'settings',
            'equipes',
            'users',
            'model_has_roles',
            'model_has_permissions',
            'clients',
            'sous_traitants',
            'chantiers',
            'chantier_sous_traitant',
            'affectations',
            'affectation_user',
            'affectation_photos',
            'absences',
            'signalements',
            $withHours ? 'time_entries' : null,
        ]));
    }

    /** Tables vidées à l'import même sans données reprises (elles pointent vers les anciens ids). */
    public const ALWAYS_CLEARED = ['time_entries', 'affectation_reminders', 'personal_access_tokens', 'push_subscriptions', 'sessions'];
}
