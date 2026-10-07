<?php

namespace App\Http\Resources;

use App\Models\Signalement;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin Signalement
 */
class SignalementResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'user' => WorkerResource::make($this->whenLoaded('user')),
            'affectation_id' => $this->affectation_id,
            'affectation' => $this->whenLoaded('affectation', fn () => $this->affectation ? [
                'id' => $this->affectation->id,
                'date' => $this->affectation->date->format('Y-m-d'),
                'chantier' => $this->affectation->chantier?->name,
            ] : null),
            'date' => $this->date?->format('Y-m-d'),
            'type' => $this->type,
            'type_label' => Signalement::TYPES[$this->type] ?? $this->type,
            'message' => $this->message,
            'read_at' => $this->read_at,
            'created_at' => $this->created_at,
        ];
    }
}
