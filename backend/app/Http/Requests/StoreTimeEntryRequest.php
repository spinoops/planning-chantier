<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreTimeEntryRequest extends FormRequest
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
            // Un planificateur peut pointer pour quelqu'un d'autre ; un ouvrier, uniquement pour lui (contrôleur).
            'user_id' => ['nullable', 'integer', Rule::exists('users', 'id')->whereNull('deleted_at')],
            'affectation_id' => ['nullable', 'integer', Rule::exists('affectations', 'id')],
            'chantier_id' => ['nullable', 'integer', Rule::exists('chantiers', 'id')->whereNull('deleted_at')],
            'date' => ['required', 'date_format:Y-m-d'],
            'start_time' => ['required', 'date_format:H:i'],
            'end_time' => ['required', 'date_format:H:i', 'after:start_time'],
            'break_minutes' => ['nullable', 'integer', 'min:0', 'max:480'],
            'comment' => ['nullable', 'string', 'max:1000'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'end_time.after' => "L'heure de fin doit être après l'heure de début.",
        ];
    }
}
