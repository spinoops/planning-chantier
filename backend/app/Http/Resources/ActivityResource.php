<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Spatie\Activitylog\Models\Activity;

/**
 * Entrée du journal d'activité (spatie/laravel-activitylog).
 *
 * @mixin Activity
 */
class ActivityResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $subject = $this->subject;

        return [
            'id' => $this->id,
            'log_name' => $this->log_name,
            'description' => $this->description,
            'event' => $this->event,
            // Type court ("User" plutôt que "App\Models\User") pour l'affichage.
            'subject_type' => $this->subject_type ? class_basename($this->subject_type) : null,
            'subject_id' => $this->subject_id,
            // Libellé lisible du sujet s'il existe encore (nom, titre… sinon #id).
            'subject_label' => $subject
                ? ($subject->name ?? $subject->title ?? $subject->label ?? '#'.$this->subject_id)
                : null,
            'causer' => $this->causer ? [
                'id' => $this->causer->id,
                'name' => $this->causer->name,
            ] : null,
            'properties' => $this->properties,
            'created_at' => $this->created_at,
        ];
    }
}
