<?php

namespace App\Http\Requests;

use App\Models\Invitation;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class StoreInvitationRequest extends FormRequest
{
    /**
     * Qui peut inviter : voir InvitationPolicy::create (admins, ou tout le
     * monde selon config/invitations.php).
     */
    public function authorize(): bool
    {
        return $this->user()->can('create', Invitation::class);
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'email' => [
                'required', 'email', 'max:255',
                // Un compte existe déjà : inutile d'inviter.
                Rule::unique('users', 'email')->withoutTrashed(),
            ],
            'role' => ['sometimes', 'string', Rule::exists('roles', 'name')],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'email.unique' => 'Cette adresse correspond déjà à un compte.',
        ];
    }

    /**
     * Règles qui dépendent de l'utilisateur connecté.
     */
    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator) {
            $user = $this->user();
            $defaultRole = (string) config('roles.default', 'user');

            // Un non-admin ne peut attribuer que le rôle par défaut.
            if ($this->input('role', $defaultRole) !== $defaultRole && ! $user->isAdmin()) {
                $validator->errors()->add('role', 'Seul un administrateur peut attribuer ce rôle.');
            }

            // Pas deux invitations en attente pour la même adresse.
            $alreadyInvited = Invitation::pending()
                ->where('email', $this->input('email'))
                ->exists();

            if ($alreadyInvited) {
                $validator->errors()->add('email', 'Une invitation est déjà en attente pour cette adresse.');
            }

            // Quota anti-abus, non appliqué aux administrateurs.
            if (! $user->isAdmin()) {
                $pending = Invitation::pending()->where('invited_by', $user->id)->count();
                $max = (int) config('invitations.max_pending_per_user');

                if ($pending >= $max) {
                    $validator->errors()->add('email', "Vous avez atteint la limite de {$max} invitations en attente.");
                }
            }
        });
    }
}
