<?php

namespace App\Http\Resources;

use App\Models\Affectation;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Http\Resources\MissingValue;

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
        // `people` porte le rôle en pivot : on sépare équipe et passages.
        $people = $this->whenLoaded('people');

        return [
            'id' => $this->id,
            'chantier_id' => $this->chantier_id,
            'equipe_id' => $this->equipe_id,
            'equipe' => $this->whenLoaded('equipe', fn () => $this->equipe ? ['id' => $this->equipe->id, 'name' => $this->equipe->name, 'color' => $this->equipe->color] : null),
            'date' => $this->date->format('Y-m-d'),
            'start_time' => $this->start_time,
            'end_time' => $this->end_time,
            'planned_minutes' => $this->plannedMinutes(),
            'note' => $this->note,
            'phase' => $this->phase,
            'chantier' => ChantierResource::make($this->whenLoaded('chantier')),
            'workers' => $this->when($people !== null && ! $people instanceof MissingValue, fn () => WorkerResource::collection($this->people->where('pivot.role', 'worker')->values())),
            'visitors' => $this->when($people !== null && ! $people instanceof MissingValue, fn () => WorkerResource::collection($this->people->where('pivot.role', 'visit')->values())),
            'photos_count' => $this->whenCounted('photos'),
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
