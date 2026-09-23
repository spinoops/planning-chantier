<?php

namespace App\Models;

use Database\Factories\InvitationFactory;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;

/**
 * Invitation nominative : un lien à usage unique et expirable permet au
 * destinataire de créer son compte (voir RegistrationController).
 */
class Invitation extends Model
{
    /** @use HasFactory<InvitationFactory> */
    use HasFactory;

    /** Longueur du token envoyé dans le lien d'invitation. */
    public const TOKEN_LENGTH = 48;

    /**
     * @var list<string>
     */
    protected $fillable = [
        'email',
        'token_hash',
        'role',
        'invited_by',
        'expires_at',
    ];

    /**
     * Le hash du token ne sort jamais de l'API.
     *
     * @var list<string>
     */
    protected $hidden = [
        'token_hash',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'expires_at' => 'datetime',
            'accepted_at' => 'datetime',
        ];
    }

    /** Utilisateur à l'origine de l'invitation. */
    public function inviter(): BelongsTo
    {
        return $this->belongsTo(User::class, 'invited_by');
    }

    /** Compte créé lors de l'acceptation, le cas échéant. */
    public function acceptedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'accepted_by');
    }

    /** Génère un token aléatoire en clair (à n'envoyer qu'au destinataire). */
    public static function generateToken(): string
    {
        return Str::random(self::TOKEN_LENGTH);
    }

    /** Empreinte stockée en base pour un token en clair. */
    public static function hashToken(string $token): string
    {
        return hash('sha256', $token);
    }

    /** Retrouve une invitation à partir du token en clair. */
    public static function findByToken(string $token): ?self
    {
        return static::where('token_hash', self::hashToken($token))->first();
    }

    public function isExpired(): bool
    {
        return $this->expires_at->isPast();
    }

    public function isAccepted(): bool
    {
        return $this->accepted_at !== null;
    }

    public function isPending(): bool
    {
        return ! $this->isAccepted() && ! $this->isExpired();
    }

    /** État lisible : pending | accepted | expired. */
    public function status(): string
    {
        return match (true) {
            $this->isAccepted() => 'accepted',
            $this->isExpired() => 'expired',
            default => 'pending',
        };
    }

    /**
     * Invitations ni acceptées ni expirées.
     *
     * @param  Builder<Invitation>  $query
     */
    public function scopePending(Builder $query): void
    {
        $query->whereNull('accepted_at')->where('expires_at', '>', now());
    }
}
