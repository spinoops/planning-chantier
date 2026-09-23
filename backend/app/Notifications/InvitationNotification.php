<?php

namespace App\Notifications;

use App\Models\Invitation;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Email envoyé au destinataire d'une invitation.
 *
 * Le token en clair n'existe qu'ici et dans la réponse HTTP faite à
 * l'inviteur : la base ne contient que son empreinte.
 */
class InvitationNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        private readonly Invitation $invitation,
        private readonly string $plainToken,
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
        $appName = config('app.name');
        $inviterName = $this->invitation->inviter->name;

        return (new MailMessage)
            ->subject("{$inviterName} vous invite à rejoindre {$appName}")
            ->greeting('Bonjour !')
            ->line("{$inviterName} vous invite à rejoindre {$appName}.")
            ->action('Créer mon compte', $this->acceptUrl())
            ->line("Ce lien est valable {$this->validityInDays()} jours et ne peut servir qu'une fois.")
            ->line("Si vous ne connaissez pas {$inviterName}, ignorez simplement ce message.");
    }

    /** Lien d'acceptation, côté SPA React. */
    public function acceptUrl(): string
    {
        return rtrim((string) config('app.frontend_url'), '/').'/register/'.$this->plainToken;
    }

    private function validityInDays(): int
    {
        return (int) config('invitations.expires_days');
    }
}
