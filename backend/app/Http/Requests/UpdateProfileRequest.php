<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateProfileRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Un utilisateur ne modifie que son nom et son email (jamais ses rôles).
     *
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255'],
            'email' => [
                'required', 'email', 'max:255',
                Rule::unique('users', 'email')->ignore($this->user()->id),
            ],
            'phone' => ['nullable', 'string', 'max:40'],
            // Notifications push : délai de rappel avant un chantier (0 = jamais) et alertes de changement.
            'notify_before_minutes' => ['sometimes', 'integer', Rule::in([0, 15, 30, 60, 120, 180])],
            'notify_changes' => ['sometimes', 'boolean'],
        ];
    }
}
