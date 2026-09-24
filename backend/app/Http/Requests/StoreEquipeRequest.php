<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreEquipeRequest extends FormRequest
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
            'name' => ['required', 'string', 'max:100'],
            'color' => ['required', 'string', 'regex:/^#[0-9a-fA-F]{6}$/'],
            'sort_order' => ['nullable', 'integer', 'min:0', 'max:65535'],
            // Membres : un employé quitte automatiquement son ancienne équipe.
            'member_ids' => ['sometimes', 'array'],
            'member_ids.*' => ['integer', 'distinct', Rule::exists('users', 'id')->whereNull('deleted_at')],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'color.regex' => 'La couleur doit être au format #rrggbb.',
        ];
    }
}
