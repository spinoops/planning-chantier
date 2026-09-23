<?php

namespace App\Http\Resources;

use App\Models\Chantier;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin Chantier
 */
class ChantierResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'client' => $this->client,
            'address' => $this->address,
            'city' => $this->city,
            'color' => $this->color,
            'status' => $this->status,
            'status_label' => Chantier::STATUSES[$this->status] ?? $this->status,
            'start_date' => $this->start_date?->format('Y-m-d'),
            'end_date' => $this->end_date?->format('Y-m-d'),
            'notes' => $this->notes,
            'affectations_count' => $this->whenCounted('affectations'),
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
