<?php

namespace App\Support;

use App\Models\Affectation;
use App\Models\User;
use App\Notifications\PlanningChangedPushNotification;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Notification;

/**
 * Prévient par push les personnes concernées par une affectation d'aujourd'hui ou
 * de demain qui vient d'être créée, modifiée ou annulée. Appelé par le
 * PlanningController après la synchronisation des personnes (l'observer Eloquent
 * se déclenche trop tôt, avant que l'équipe soit attachée).
 */
class PlanningPush
{
    /**
     * @param  'created'|'updated'|'deleted'  $event
     * @param  list<int>  $alsoUserIds  personnes à prévenir en plus (ex. retirées de l'affectation)
     */
    public static function changed(Affectation $affectation, string $event, array $alsoUserIds = [], ?string $previousDate = null): void
    {
        $dates = array_filter([$affectation->date?->toDateString(), $previousDate]);
        $soon = collect($dates)->contains(fn (string $d) => in_array($d, [today()->toDateString(), today()->addDay()->toDateString()], true));
        if (! $soon) {
            return;
        }

        $affectation->loadMissing(['chantier', 'people']);
        $ids = $affectation->people->pluck('id')->merge($alsoUserIds)->unique()->values();
        if ($actor = Auth::id()) {
            $ids = $ids->reject(fn (int $id) => $id === $actor);
        }
        if ($ids->isEmpty()) {
            return;
        }

        $recipients = User::query()
            ->whereKey($ids->all())
            ->where('notify_changes', true)
            ->whereHas('pushSubscriptions')
            ->get();
        if ($recipients->isEmpty()) {
            return;
        }

        Notification::send($recipients, new PlanningChangedPushNotification($affectation, $event));
    }
}
