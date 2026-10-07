<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UpdateSettingsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'app_name' => ['required', 'string', 'max:255'],
            'app_logo_url' => ['nullable', 'string', 'max:2048'],
            'app_color' => ['required', 'string', 'regex:/^#[0-9A-Fa-f]{6}$/'],
            // Horaires types du planning (Matin / Après-midi) et heure de veille des changements tardifs.
            'planning_morning_start' => ['sometimes', 'date_format:H:i'],
            'planning_morning_end' => ['sometimes', 'date_format:H:i', 'after:planning_morning_start'],
            'planning_afternoon_start' => ['sometimes', 'date_format:H:i'],
            'planning_afternoon_end' => ['sometimes', 'date_format:H:i', 'after:planning_afternoon_start'],
            'planning_notify_after' => ['sometimes', 'date_format:H:i'],
        ];
    }
}
