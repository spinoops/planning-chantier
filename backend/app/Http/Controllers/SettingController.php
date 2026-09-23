<?php

namespace App\Http\Controllers;

use App\Http\Requests\UpdateSettingsRequest;
use App\Models\Setting;
use App\Support\Modules;
use Illuminate\Http\JsonResponse;

class SettingController extends Controller
{
    /**
     * Réglages publics de l'app : identité (nom, logo, couleur), état des
     * modules et options utiles au front avant même la connexion.
     */
    public function index(): JsonResponse
    {
        return response()->json($this->payload());
    }

    /**
     * Met à jour les réglages d'identité (réservé aux admins via le middleware).
     */
    public function update(UpdateSettingsRequest $request): JsonResponse
    {
        Setting::setMany($request->validated());

        activity()->causedBy($request->user())->event('settings_updated')->log('Configuration modifiée');

        return response()->json($this->payload());
    }

    /**
     * @return array<string, mixed>
     */
    private function payload(): array
    {
        return array_merge(Setting::allAsArray(), [
            'modules' => Modules::enabledMap(),
            'features' => [
                'invitations_for_everyone' => config('invitations.who_can_invite') === 'everyone',
            ],
        ]);
    }
}
