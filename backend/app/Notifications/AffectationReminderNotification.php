<?php

namespace App\Notifications;

use App\Models\Affectation;
use App\Models\Setting;
use Illuminate\Notifications\Notification;
use NotificationChannels\WebPush\WebPushChannel;
use NotificationChannels\WebPush\WebPushMessage;

/**
 * Rappel push « Dans 1 h : chantier X » envoyé à chaque personne affectée,
 * `notify_before_minutes` avant le début du créneau (commande planning:remind).
 */
class AffectationReminderNotification extends Notification
{
    public function __construct(
        public readonly Affectation $affectation,
        public readonly int $minutesBefore,
    ) {}

    /** @return list<string> */
    public function via(object $notifiable): array
    {
        return [WebPushChannel::class];
    }

    public function toWebPush(object $notifiable): WebPushMessage
    {
        $a = $this->affectation;
        $chantier = $a->chantier;
        $place = implode(', ', array_filter([$chantier?->address, $chantier?->city]));
        $slot = $a->start_time ? substr($a->start_time, 0, 5).($a->end_time ? ' – '.substr($a->end_time, 0, 5) : '') : 'Journée';
        $lines = array_filter([$slot.($place ? ' · '.$place : ''), $a->phase, $a->note]);

        return (new WebPushMessage)
            ->title(self::delayLabel($this->minutesBefore).' : '.($chantier?->name ?? 'Chantier'))
            ->body(implode("\n", $lines))
            ->icon('/favicon.svg')
            ->badge('/favicon.svg')
            ->tag('affectation-'.$a->id)
            ->renotify(true)
            ->data(['url' => '/mon-planning?d='.$a->date->toDateString(), 'affectation_id' => $a->id])
            ->action('Voir', 'open')
            ->options(['TTL' => max(600, $this->minutesBefore * 60)]);
    }

    /** « Dans 1 h », « Dans 30 min »… */
    public static function delayLabel(int $minutes): string
    {
        if ($minutes % 60 === 0) {
            return 'Dans '.intdiv($minutes, 60).' h';
        }

        return 'Dans '.$minutes.' min';
    }

    /** Nom de l'app, pour les titres génériques. */
    public static function appName(): string
    {
        return Setting::get('app_name') ?: config('app.name', 'Planning');
    }
}
