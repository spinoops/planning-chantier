<?php

namespace App\Notifications;

use App\Models\Affectation;
use Illuminate\Notifications\Notification;
use NotificationChannels\WebPush\WebPushChannel;
use NotificationChannels\WebPush\WebPushMessage;

/**
 * Push envoyé aux personnes concernées quand une affectation d'aujourd'hui ou de
 * demain est créée, modifiée ou annulée (`users.notify_changes`).
 */
class PlanningChangedPushNotification extends Notification
{
    /**
     * @param  'created'|'updated'|'deleted'  $event
     */
    public function __construct(
        public readonly Affectation $affectation,
        public readonly string $event,
    ) {}

    /** @return list<string> */
    public function via(object $notifiable): array
    {
        return [WebPushChannel::class];
    }

    public function toWebPush(object $notifiable): WebPushMessage
    {
        $a = $this->affectation;
        $day = $a->date->isToday() ? "aujourd'hui" : ($a->date->isTomorrow() ? 'demain' : $a->date->translatedFormat('D j M'));
        $slot = $a->start_time ? substr($a->start_time, 0, 5).($a->end_time ? ' – '.substr($a->end_time, 0, 5) : '') : 'journée';
        $title = match ($this->event) {
            'created' => 'Nouveau chantier '.$day,
            'deleted' => 'Chantier annulé '.$day,
            default => 'Planning modifié '.$day,
        };
        $place = implode(', ', array_filter([$a->chantier?->address, $a->chantier?->city]));

        return (new WebPushMessage)
            ->title($title)
            ->body(trim(($a->chantier?->name ?? 'Chantier').' · '.$slot.($place ? "\n".$place : '')))
            ->icon('/favicon.svg')
            ->badge('/favicon.svg')
            ->tag('planning-'.$a->date->toDateString())
            ->renotify(true)
            ->data(['url' => '/mon-planning?d='.$a->date->toDateString(), 'affectation_id' => $a->id])
            ->action('Voir', 'open')
            ->options(['TTL' => 6 * 3600]);
    }
}
