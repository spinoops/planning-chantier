<?php

namespace App\Notifications;

use App\Models\Affectation;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Email envoyé aux planificateurs quand le planning du lendemain (ou du jour)
 * change après l'heure de veille (réglage `planning_notify_after`, 16:00 par défaut).
 */
class PlanningChangedNotification extends Notification
{
    use Queueable;

    /**
     * @param  'created'|'updated'|'deleted'  $event
     */
    public function __construct(
        private readonly Affectation $affectation,
        private readonly string $event,
        private readonly ?string $actorName,
    ) {}

    /**
     * @return list<string>
     */
    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $a = $this->affectation;
        $chantier = $a->chantier?->name ?? 'Chantier supprimé';
        $date = $a->date->translatedFormat('l j F');
        $verb = match ($this->event) {
            'created' => 'ajoutée',
            'deleted' => 'supprimée',
            default => 'modifiée',
        };
        $who = $this->actorName ?? 'Quelqu’un';
        $people = $a->relationLoaded('people') ? $a->people->pluck('name')->join(', ') : '';
        $url = rtrim((string) config('app.frontend_url'), '/').'/planning?view=day&d='.$a->date->toDateString();

        return (new MailMessage)
            ->subject("Planning de {$date} modifié tardivement")
            ->greeting('Bonjour,')
            ->line("{$who} a {$verb} une affectation pour {$date} : {$chantier}"
                .($a->start_time ? " ({$a->start_time}".($a->end_time ? " – {$a->end_time}" : '').')' : '').'.')
            ->lineIf($people !== '', "Équipe : {$people}.")
            ->action('Voir le planning', $url)
            ->line('Ce message est envoyé parce que le changement a eu lieu après l’heure de veille configurée.');
    }
}
