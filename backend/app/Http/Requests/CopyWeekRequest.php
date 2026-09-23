<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class CopyWeekRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Copie les affectations d'une semaine (lundi `from`) vers une autre (lundi `to`).
     *
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'from' => ['required', 'date_format:Y-m-d'],
            'to' => ['required', 'date_format:Y-m-d', 'different:from'],
            // true = supprimer d'abord les affectations existantes de la semaine cible.
            'replace' => ['sometimes', 'boolean'],
        ];
    }
}
