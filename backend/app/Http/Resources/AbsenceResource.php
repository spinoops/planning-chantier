<?php

namespace App\Http\Resources;

use App\Models\Absence;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin Absence
 */
class AbsenceResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'user_id' => $this->user_id,
            'user' => WorkerResource::make($this->whenLoaded('user')),
            'start_date' => $this->start_date->format('Y-m-d'),
            'end_date' => $this->end_date->format('Y-m-d'),
            'type' => $this->type,
            'type_label' => Absence::TYPES[$this->type] ?? $this->type,
            'note' => $this->note,
            'created_at' => $this->created_at,
        ];
    }
}
