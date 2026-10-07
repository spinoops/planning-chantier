<?php

namespace App\Http\Resources;

use App\Models\AffectationPhoto;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin AffectationPhoto
 */
class AffectationPhotoResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'affectation_id' => $this->affectation_id,
            'url' => $this->url(),
            'caption' => $this->caption,
            'user' => $this->whenLoaded('user', fn () => $this->user ? ['id' => $this->user->id, 'name' => $this->user->name] : null),
            'created_at' => $this->created_at,
        ];
    }
}
