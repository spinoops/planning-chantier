<?php

namespace App\Http\Requests;

use App\Models\Signalement;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreSignalementRequest extends FormRequest
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
            'affectation_id' => ['nullable', 'integer', Rule::exists('affectations', 'id')],
            'date' => ['nullable', 'date_format:Y-m-d'],
            'type' => ['required', Rule::in(array_keys(Signalement::TYPES))],
            'message' => ['required', 'string', 'max:2000'],
        ];
    }
}
