<?php

namespace App\Observers;

use App\Models\Affectation;
use App\Models\Setting;
use App\Models\User;
use App\Notifications\PlanningChangedNotification;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Notification;

/**
 * Prévient les planificateurs (sauf l'auteur du changement) quand une affectation
 * d'aujourd'hui ou de demain est créée, modifiée ou supprimée après l'heure de
 * veille (`planning_notify_after`). Un même jour n'est signalé qu'une fois par
 * tranche de 10 minutes et par auteur, pour éviter une rafale d'emails.
 */
class AffectationObserver
{
    public function created(Affectation $affectation): void
    {
        $this->notify($affectation, 'created');
    }

    public function updated(Affectation $affectation): void
    {
        $this->notify($affectation, 'updated');
    }

    public function deleted(Affectation $affectation): void
    {
        $this->notify($affectation, 'deleted');
    }

    private function notify(Affectation $affectation, string $event): void
    {
        $date = $affectation->date;
        $today = now()->startOfDay();
        if (! $date->isSameDay($today) && ! $date->isSameDay($today->copy()->addDay())) {
            return;
        }

        $after = Setting::get('planning_notify_after', '16:00') ?: '16:00';
        [$h, $m] = array_map('intval', explode(':', $after));
        if (now()->lt(now()->setTime($h, $m))) {
            return;
        }

        $actor = Auth::user();
        $key = 'planning-late-change:'.$date->toDateString().':'.($actor?->id ?? 0);
        if (! Cache::add($key, true, now()->addMinutes(10))) {
            return;
        }

        $recipients = User::role((array) config('roles.planners', ['admin']))
            ->when($actor, fn ($q) => $q->whereKeyNot($actor->id))
            ->get();
        if ($recipients->isEmpty()) {
            return;
        }

        $affectation->loadMissing(['chantier', 'people']);
        Notification::send($recipients, new PlanningChangedNotification($affectation, $event, $actor?->name));
    }
}
