<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Absence d'un employé (vacances, maladie, école…) : il est grisé dans le planning.
 */
class Absence extends Model
{
    use HasFactory;

    public const TYPES = ['vacances' => 'Vacances', 'maladie' => 'Maladie', 'ecole' => 'École / formation', 'autre' => 'Autre'];

    protected $fillable = ['user_id', 'start_date', 'end_date', 'type', 'note', 'created_by'];

    protected function casts(): array
    {
        return [
            'start_date' => 'date:Y-m-d',
            'end_date' => 'date:Y-m-d',
        ];
    }

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Absences qui touchent la période [from, to].
     *
     * @param  Builder<Absence>  $query
     */
    public function scopeOverlapping(Builder $query, string $from, string $to): void
    {
        $query->where('start_date', '<=', $to)->where('end_date', '>=', $from);
    }

    /**
     * Ids des utilisateurs absents à une date donnée.
     *
     * @return list<int>
     */
    public static function absentUserIds(string $date): array
    {
        return self::query()->overlapping($date, $date)->pluck('user_id')->unique()->values()->all();
    }
}
