<?php

namespace App\Http\Resources;

use App\Models\Equipe;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin Equipe
 */
class EquipeResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'color' => $this->color,
            'sort_order' => $this->sort_order,
            'expires_at' => $this->expires_at?->format('Y-m-d'),
            'members' => WorkerResource::collection($this->whenLoaded('members')),
            'affectations_count' => $this->whenCounted('affectations'),
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
