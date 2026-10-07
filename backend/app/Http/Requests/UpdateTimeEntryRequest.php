<?php

namespace App\Http\Requests;

class UpdateTimeEntryRequest extends StoreTimeEntryRequest
{
    /**
     * Tous les champs sont optionnels en modification.
     *
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        $rules = parent::rules();
        foreach (['date', 'start_time', 'end_time'] as $field) {
            $rules[$field][0] = 'sometimes';
        }

        return $rules;
    }
}
