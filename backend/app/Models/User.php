<?php

namespace App\Models;

use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;
use Spatie\Activitylog\LogOptions;
use Spatie\Activitylog\Traits\LogsActivity;
use Spatie\Permission\Traits\HasRoles;

class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasApiTokens, HasFactory, HasRoles, LogsActivity, Notifiable, SoftDeletes;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'name',
        'email',
        'password',
        'phone',
        'job_title',
        'color',
        'equipe_id',
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var list<string>
     */
    protected $hidden = [
        'password',
        'remember_token',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
        ];
    }

    /**
     * L'utilisateur a-t-il le rôle administrateur ?
     */
    public function isAdmin(): bool
    {
        return $this->hasRole('admin');
    }

    /**
     * L'utilisateur peut-il gérer chantiers et planning (config roles.planners) ?
     */
    public function isPlanner(): bool
    {
        return $this->hasAnyRole((array) config('roles.planners', ['admin']));
    }

    /**
     * Équipe de rattachement (planification par équipe).
     *
     * @return BelongsTo<Equipe, $this>
     */
    public function equipe(): BelongsTo
    {
        return $this->belongsTo(Equipe::class);
    }

    /**
     * Affectations (jours de chantier) où figure cet utilisateur (équipe ou passage).
     *
     * @return BelongsToMany<Affectation, $this>
     */
    public function affectations(): BelongsToMany
    {
        return $this->belongsToMany(Affectation::class)->withPivot('role');
    }

    /** @return HasMany<TimeEntry, $this> */
    public function timeEntries(): HasMany
    {
        return $this->hasMany(TimeEntry::class);
    }

    /** @return HasMany<Absence, $this> */
    public function absences(): HasMany
    {
        return $this->hasMany(Absence::class);
    }

    /**
     * Utilisateurs pouvant être placés sur un chantier (config roles.assignable).
     *
     * @param  Builder<User>  $query
     */
    public function scopeAssignable(Builder $query): void
    {
        $query->role((array) config('roles.assignable', ['ouvrier']));
    }

    /**
     * Recherche plein texte simple sur le nom et l'email (?search=).
     *
     * @param  Builder<User>  $query
     */
    public function scopeSearch(Builder $query, ?string $term): void
    {
        $term = trim((string) $term);
        if ($term === '') {
            return;
        }

        $query->where(function (Builder $q) use ($term) {
            $q->where('name', 'like', "%{$term}%")
                ->orWhere('email', 'like', "%{$term}%")
                ->orWhere('job_title', 'like', "%{$term}%");
        });
    }

    /**
     * Journalise les changements de profil (jamais le mot de passe).
     */
    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()
            ->logOnly(['name', 'email', 'phone', 'job_title'])
            ->logOnlyDirty()
            ->dontSubmitEmptyLogs();
    }
}
