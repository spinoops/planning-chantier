<?php

namespace App\Models;

use Database\Factories\AffectationFactory;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Spatie\Activitylog\LogOptions;
use Spatie\Activitylog\Traits\LogsActivity;

/**
 * Un chantier placé sur un jour du calendrier, avec les ouvriers affectés.
 */
class Affectation extends Model
{
    /** @use HasFactory<AffectationFactory> */
    use HasFactory, LogsActivity;

    protected $fillable = [
        'chantier_id',
        'date',
        'start_time',
        'end_time',
        'note',
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

    /** Ouvriers (et chefs) envoyés sur le chantier ce jour-là. @return BelongsToMany<User, $this> */
    public function workers(): BelongsToMany
    {
        return $this->belongsToMany(User::class)->orderBy('name');
    }

    /** @return BelongsTo<User, $this> */
    public function author(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
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
     * Affectations où figure cet utilisateur.
     *
     * @param  Builder<Affectation>  $query
     */
    public function scopeForWorker(Builder $query, int $userId): void
    {
        $query->whereHas('workers', fn (Builder $q) => $q->where('users.id', $userId));
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

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()
            ->logOnly(['chantier_id', 'date', 'start_time', 'end_time'])
            ->logOnlyDirty()
            ->dontSubmitEmptyLogs();
    }
}
