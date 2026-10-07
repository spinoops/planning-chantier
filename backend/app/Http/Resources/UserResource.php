<?php

namespace App\Http\Resources;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin User
 */
class UserResource extends JsonResource
{
    /**
     * Représentation publique d'un utilisateur (jamais le mot de passe).
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'email' => $this->email,
            'phone' => $this->phone,
            'notify_before_minutes' => (int) ($this->notify_before_minutes ?? 0),
            'notify_changes' => (bool) ($this->notify_changes ?? true),
            'job_title' => $this->job_title,
            'color' => $this->color,
            'equipe_id' => $this->equipe_id,
            'equipe' => $this->whenLoaded('equipe', fn () => $this->equipe ? ['id' => $this->equipe->id, 'name' => $this->equipe->name, 'color' => $this->equipe->color] : null),
            'roles' => $this->getRoleNames(),
            // Permissions effectives (directes + héritées des rôles), pour des
            // contrôles fins côté front (`can('facture.create')`).
            'permissions' => $this->getAllPermissions()->pluck('name'),
            'email_verified_at' => $this->email_verified_at,
            'deleted_at' => $this->when($this->trashed(), $this->deleted_at),
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
