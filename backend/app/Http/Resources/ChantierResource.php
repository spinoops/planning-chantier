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
            'client_id' => $this->client_id,
            'client_record' => ClientResource::make($this->whenLoaded('clientRecord')),
            'address' => $this->address,
            'city' => $this->city,
            'color' => $this->color,
            'status' => $this->status,
            'status_label' => Chantier::STATUSES[$this->status] ?? $this->status,
            'start_date' => $this->start_date?->format('Y-m-d'),
            'end_date' => $this->end_date?->format('Y-m-d'),
            'notes' => $this->notes,
            // Préparation (étape 1).
            'estimated_hours' => $this->estimated_hours,
            'mesures' => $this->mesures,
            'materiel' => $this->materiel ?? [],
            'sous_traitants' => SousTraitantResource::collection($this->whenLoaded('sousTraitants')),
            // Devis (étape 2), reprise des mesures (3), estimation planning (4).
            'quote_status' => $this->quote_status,
            'quote_status_label' => Chantier::QUOTE_STATUSES[$this->quote_status] ?? $this->quote_status,
            'quote_amount' => $this->quote_amount,
            'quote_sent_at' => $this->quote_sent_at?->format('Y-m-d'),
            'quote_accepted_at' => $this->quote_accepted_at?->format('Y-m-d'),
            'remeasure_needed' => (bool) $this->remeasure_needed,
            'remeasured_at' => $this->remeasured_at?->format('Y-m-d'),
            'planning_hours' => $this->planning_hours,
            'affectations_count' => $this->whenCounted('affectations'),
            'time_entries_count' => $this->whenCounted('timeEntries'),
            'steps' => $this->when($this->resource->relationLoaded('sousTraitants') || $request->routeIs('chantiers.show'), fn () => $this->steps()),
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
