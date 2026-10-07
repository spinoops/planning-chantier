<?php

namespace App\Http\Requests;

use App\Models\Chantier;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreChantierRequest extends FormRequest
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
            'name' => ['required', 'string', 'max:255'],
            // Client : fiche sélectionnée (client_id) et/ou libellé libre (compatibilité).
            'client' => ['nullable', 'string', 'max:255'],
            'client_id' => ['nullable', 'integer', Rule::exists('clients', 'id')->whereNull('deleted_at')],
            'address' => ['nullable', 'string', 'max:255'],
            'city' => ['nullable', 'string', 'max:120'],
            'color' => ['required', 'string', 'regex:/^#[0-9a-fA-F]{6}$/'],
            'status' => ['required', Rule::in(array_keys(Chantier::STATUSES))],
            'start_date' => ['nullable', 'date'],
            'end_date' => ['nullable', 'date', 'after_or_equal:start_date'],
            'notes' => ['nullable', 'string', 'max:5000'],
            // Étape 1 : préparation.
            'estimated_hours' => ['nullable', 'numeric', 'min:0', 'max:100000'],
            'mesures' => ['nullable', 'string', 'max:10000'],
            'materiel' => ['nullable', 'array', 'max:200'],
            'materiel.*.label' => ['required', 'string', 'max:255'],
            'materiel.*.qty' => ['nullable', 'string', 'max:50'],
            'materiel.*.done' => ['nullable', 'boolean'],
            'sous_traitants' => ['nullable', 'array', 'max:50'],
            'sous_traitants.*.id' => ['required', 'integer', Rule::exists('sous_traitants', 'id')->whereNull('deleted_at')],
            'sous_traitants.*.note' => ['nullable', 'string', 'max:255'],
            'sous_traitants.*.planned_date' => ['nullable', 'date_format:Y-m-d'],
            // Étape 2 : devis (suivi).
            'quote_status' => ['nullable', Rule::in(array_keys(Chantier::QUOTE_STATUSES))],
            'quote_amount' => ['nullable', 'numeric', 'min:0', 'max:100000000'],
            'quote_sent_at' => ['nullable', 'date_format:Y-m-d'],
            'quote_accepted_at' => ['nullable', 'date_format:Y-m-d'],
            // Étape 3 : reprise des mesures sur place.
            'remeasure_needed' => ['nullable', 'boolean'],
            'remeasured_at' => ['nullable', 'date_format:Y-m-d'],
            // Étape 4 : estimation pour le planning.
            'planning_hours' => ['nullable', 'numeric', 'min:0', 'max:100000'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'color.regex' => 'La couleur doit être au format #rrggbb.',
            'end_date.after_or_equal' => 'La date de fin doit être postérieure à la date de début.',
        ];
    }
}
