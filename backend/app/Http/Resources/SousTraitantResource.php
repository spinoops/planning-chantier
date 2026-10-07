<?php

namespace App\Http\Resources;

use App\Models\SousTraitant;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin SousTraitant
 */
class SousTraitantResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'trade' => $this->trade,
            'contact_name' => $this->contact_name,
            'phone' => $this->phone,
            'email' => $this->email,
            'notes' => $this->notes,
            // Présent quand chargé via un chantier (pivot).
            'note' => $this->whenPivotLoaded('chantier_sous_traitant', fn () => $this->pivot->note),
            'planned_date' => $this->whenPivotLoaded('chantier_sous_traitant', fn () => $this->pivot->planned_date),
            'chantiers_count' => $this->whenCounted('chantiers'),
            'created_at' => $this->created_at,
        ];
    }
}
