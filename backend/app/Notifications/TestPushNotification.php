<?php

namespace App\Notifications;

use Illuminate\Notifications\Notification;
use NotificationChannels\WebPush\WebPushChannel;
use NotificationChannels\WebPush\WebPushMessage;

/** Notification de test déclenchée depuis « Mon profil » pour vérifier qu'un appareil reçoit bien les alertes. */
class TestPushNotification extends Notification
{
    /** @return list<string> */
    public function via(object $notifiable): array
    {
        return [WebPushChannel::class];
    }

    public function toWebPush(object $notifiable): WebPushMessage
    {
        return (new WebPushMessage)
            ->title(AffectationReminderNotification::appName())
            ->body('Les alertes fonctionnent sur cet appareil. Tu seras prévenu avant chaque chantier.')
            ->icon('/favicon.svg')
            ->badge('/favicon.svg')
            ->tag('test')
            ->data(['url' => '/mon-planning'])
            ->options(['TTL' => 300]);
    }
}
