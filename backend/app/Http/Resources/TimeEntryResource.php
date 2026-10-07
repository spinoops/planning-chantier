<?php

namespace App\Http\Resources;

use App\Models\TimeEntry;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin TimeEntry
 */
class TimeEntryResource extends JsonResource
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
            'affectation_id' => $this->affectation_id,
            'chantier_id' => $this->chantier_id,
            'chantier' => ChantierResource::make($this->whenLoaded('chantier')),
            'date' => $this->date->format('Y-m-d'),
            'start_time' => $this->start_time,
            'end_time' => $this->end_time,
            'break_minutes' => $this->break_minutes,
            'minutes' => $this->minutes(),
            'comment' => $this->comment,
            'status' => $this->status,
            'status_label' => TimeEntry::STATUSES[$this->status] ?? $this->status,
            'validated_at' => $this->validated_at,
            'validator' => $this->whenLoaded('validator', fn () => $this->validator ? ['id' => $this->validator->id, 'name' => $this->validator->name] : null),
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
