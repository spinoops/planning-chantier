<?php

namespace App\Http\Requests;

class UpdateAffectationRequest extends StoreAffectationRequest
{
    /**
     * En modification, tous les champs sont optionnels : on peut ne changer
     * que la date (glisser-déposer dans le calendrier) ou que l'équipe.
     * La récurrence ne s'applique qu'à la création.
     *
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        $rules = parent::rules();
        $rules['chantier_id'][0] = 'sometimes';
        $rules['date'][0] = 'sometimes';
        unset($rules['repeat_until'], $rules['repeat_days'], $rules['repeat_days.*']);

        return $rules;
    }
}
