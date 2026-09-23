<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UpdateModulesRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * `modules` : carte clé => booléen, limitée aux modules déclarés
     * dans config/modules.php (les clés inconnues sont écartées).
     *
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'modules' => ['required', 'array'],
            'modules.*' => ['boolean'],
        ];
    }

    protected function prepareForValidation(): void
    {
        $known = array_keys((array) config('modules', []));
        $modules = (array) $this->input('modules', []);

        $this->merge([
            'modules' => array_intersect_key($modules, array_flip($known)),
        ]);
    }
}
