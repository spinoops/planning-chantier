<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreAffectationRequest extends FormRequest
{
    /** L'accès est filtré en amont par le middleware `role:` (planificateurs). */
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
            'chantier_id' => ['required', 'integer', Rule::exists('chantiers', 'id')->whereNull('deleted_at')],
            // Équipe planifiée : sans `worker_ids`, ses membres sont recopiés dans l'affectation.
            'equipe_id' => ['nullable', 'integer', Rule::exists('equipes', 'id')],
            'date' => ['required', 'date_format:Y-m-d'],
            'start_time' => ['nullable', 'date_format:H:i'],
            'end_time' => ['nullable', 'date_format:H:i', 'after:start_time'],
            'note' => ['nullable', 'string', 'max:2000'],
            'worker_ids' => ['sometimes', 'array'],
            'worker_ids.*' => ['integer', 'distinct', Rule::exists('users', 'id')->whereNull('deleted_at')],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'chantier_id.required' => 'Choisis un chantier.',
            'end_time.after' => "L'heure de fin doit être après l'heure de début.",
        ];
    }
}
