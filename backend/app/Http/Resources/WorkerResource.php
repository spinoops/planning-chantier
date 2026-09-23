<?php

namespace App\Http\Resources;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Représentation légère d'un membre de l'équipe (sélecteurs, cartes du planning).
 *
 * @mixin User
 */
class WorkerResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'phone' => $this->phone,
            'job_title' => $this->job_title,
            'color' => $this->color,
            'roles' => $this->whenLoaded('roles', fn () => $this->getRoleNames()),
        ];
    }
}
