<?php

namespace App\Models;

use Database\Factories\AffectationFactory;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Spatie\Activitylog\LogOptions;
use Spatie\Activitylog\Traits\LogsActivity;

/**
 * Un chantier placé sur un jour du calendrier, avec l'équipe envoyée et,
 * éventuellement, le passage du patron / d'un chef (rôle « visit »).
 */
class Affectation extends Model
{
    /** @use HasFactory<AffectationFactory> */
    use HasFactory, LogsActivity;

    protected $fillable = [
        'chantier_id',
        'equipe_id',
        'date',
        'start_time',
        'end_time',
        'note',
        'phase',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'date' => 'date:Y-m-d',
        ];
    }

    /** @return BelongsTo<Chantier, $this> */
    public function chantier(): BelongsTo
    {
        return $this->belongsTo(Chantier::class);
    }

    /** Équipe planifiée (ses membres sont recopiés dans `workers` à la création). @return BelongsTo<Equipe, $this> */
    public function equipe(): BelongsTo
    {
        return $this->belongsTo(Equipe::class);
    }

    /**
     * Toutes les personnes liées (équipe + passages), avec leur rôle en pivot.
     *
     * @return BelongsToMany<User, $this>
     */
    public function people(): BelongsToMany
    {
        return $this->belongsToMany(User::class)->withPivot('role')->orderBy('name');
    }

    /** Ouvriers envoyés sur le chantier ce jour-là (rôle « worker »). @return BelongsToMany<User, $this> */
    public function workers(): BelongsToMany
    {
        return $this->people()->wherePivot('role', 'worker');
    }

    /** Passages (patron / chef qui passe contrôler) — rôle « visit ». @return BelongsToMany<User, $this> */
    public function visitors(): BelongsToMany
    {
        return $this->people()->wherePivot('role', 'visit');
    }

    /** @return HasMany<AffectationPhoto, $this> */
    public function photos(): HasMany
    {
        return $this->hasMany(AffectationPhoto::class)->latest();
    }

    /** @return HasMany<TimeEntry, $this> */
    public function timeEntries(): HasMany
    {
        return $this->hasMany(TimeEntry::class);
    }

    /** @return BelongsTo<User, $this> */
    public function author(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /**
     * Remplace ouvriers et passages d'un coup.
     *
     * @param  list<int>  $workerIds
     * @param  list<int>  $visitorIds
     */
    public function syncPeople(array $workerIds, array $visitorIds = []): void
    {
        $sync = [];
        foreach ($visitorIds as $id) {
            $sync[(int) $id] = ['role' => 'visit'];
        }
        foreach ($workerIds as $id) {
            $sync[(int) $id] = ['role' => 'worker']; // un ouvrier prime sur un passage
        }
        $this->people()->sync($sync);
    }

    /**
     * Affectations comprises entre deux dates (incluses).
     *
     * @param  Builder<Affectation>  $query
     */
    public function scopeBetween(Builder $query, string $from, string $to): void
    {
        $query->whereBetween('date', [$from, $to]);
    }

    /**
     * Affectations où figure cet utilisateur (équipe ou passage).
     *
     * @param  Builder<Affectation>  $query
     */
    public function scopeForWorker(Builder $query, int $userId): void
    {
        $query->whereHas('people', fn (Builder $q) => $q->where('users.id', $userId));
    }

    /** Heures « HH:MM » (la colonne TIME renvoie HH:MM:SS). */
    public function getStartTimeAttribute(?string $value): ?string
    {
        return $value ? substr($value, 0, 5) : null;
    }

    public function getEndTimeAttribute(?string $value): ?string
    {
        return $value ? substr($value, 0, 5) : null;
    }

    /** Durée planifiée en minutes (0 si journée sans horaire). */
    public function plannedMinutes(): int
    {
        if (! $this->start_time || ! $this->end_time) {
            return 0;
        }
        [$sh, $sm] = array_map('intval', explode(':', $this->start_time));
        [$eh, $em] = array_map('intval', explode(':', $this->end_time));

        return max(0, ($eh * 60 + $em) - ($sh * 60 + $sm));
    }

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()
            ->logOnly(['chantier_id', 'equipe_id', 'date', 'start_time', 'end_time', 'phase'])
            ->logOnlyDirty()
            ->dontSubmitEmptyLogs();
    }
}
