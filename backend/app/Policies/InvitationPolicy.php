<?php

namespace App\Policies;

use App\Models\Invitation;
use App\Models\User;

class InvitationPolicy
{
    /**
     * Émettre une invitation : les admins toujours ; les autres selon
     * config('invitations.who_can_invite').
     */
    public function create(User $user): bool
    {
        return $user->isAdmin() || config('invitations.who_can_invite') === 'everyone';
    }

    /**
     * Révoquer une invitation : son auteur ou un admin.
     */
    public function delete(User $user, Invitation $invitation): bool
    {
        return $user->isAdmin() || $invitation->invited_by === $user->id;
    }
}
