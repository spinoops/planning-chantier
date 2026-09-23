<?php

namespace App\Http\Resources;

use App\Models\Affectation;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin Affectation
 */
class AffectationResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'chantier_id' => $this->chantier_id,
            'date' => $this->date->format('Y-m-d'),
            'start_time' => $this->start_time,
            'end_time' => $this->end_time,
            'note' => $this->note,
            'chantier' => ChantierResource::make($this->whenLoaded('chantier')),
            'workers' => WorkerResource::collection($this->whenLoaded('workers')),
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
