<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Spatie\Activitylog\LogOptions;
use Spatie\Activitylog\Traits\LogsActivity;

/**
 * Heures pointées par un employé sur un chantier (brouillon → soumis → validé).
 */
class TimeEntry extends Model
{
    use HasFactory, LogsActivity;

    public const STATUSES = ['draft' => 'Brouillon', 'submitted' => 'Soumis', 'validated' => 'Validé'];

    protected $fillable = [
        'user_id',
        'affectation_id',
        'chantier_id',
        'date',
        'start_time',
        'end_time',
        'break_minutes',
        'comment',
        'status',
        'validated_by',
        'validated_at',
    ];

    protected function casts(): array
    {
        return [
            'date' => 'date:Y-m-d',
            'break_minutes' => 'integer',
            'validated_at' => 'datetime',
        ];
    }

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** @return BelongsTo<Affectation, $this> */
    public function affectation(): BelongsTo
    {
        return $this->belongsTo(Affectation::class);
    }

    /** @return BelongsTo<Chantier, $this> */
    public function chantier(): BelongsTo
    {
        return $this->belongsTo(Chantier::class);
    }

    /** @return BelongsTo<User, $this> */
    public function validator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'validated_by');
    }

    /** @param  Builder<TimeEntry>  $query */
    public function scopeBetween(Builder $query, string $from, string $to): void
    {
        $query->whereBetween('date', [$from, $to]);
    }

    /** Heures « HH:MM ». */
    public function getStartTimeAttribute(?string $value): ?string
    {
        return $value ? substr($value, 0, 5) : null;
    }

    public function getEndTimeAttribute(?string $value): ?string
    {
        return $value ? substr($value, 0, 5) : null;
    }

    /** Durée travaillée en minutes (fin − début − pause). */
    public function minutes(): int
    {
        if (! $this->start_time || ! $this->end_time) {
            return 0;
        }
        [$sh, $sm] = array_map('intval', explode(':', $this->start_time));
        [$eh, $em] = array_map('intval', explode(':', $this->end_time));

        return max(0, ($eh * 60 + $em) - ($sh * 60 + $sm) - (int) $this->break_minutes);
    }

    public function isLocked(): bool
    {
        return $this->status === 'validated';
    }

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()
            ->logOnly(['date', 'start_time', 'end_time', 'break_minutes', 'status'])
            ->logOnlyDirty()
            ->dontSubmitEmptyLogs();
    }
}
