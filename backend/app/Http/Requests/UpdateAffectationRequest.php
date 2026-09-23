<?php

namespace App\Http\Requests;

class UpdateAffectationRequest extends StoreAffectationRequest
{
    /**
     * En modification, tous les champs sont optionnels : on peut ne changer
     * que la date (glisser-déposer dans le calendrier) ou que l'équipe.
     *
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        $rules = parent::rules();
        $rules['chantier_id'][0] = 'sometimes';
        $rules['date'][0] = 'sometimes';
        $rules['worker_ids'][0] = 'sometimes';

        return $rules;
    }
}
