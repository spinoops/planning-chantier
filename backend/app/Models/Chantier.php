<?php

namespace App\Models;

use Database\Factories\ChantierFactory;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Spatie\Activitylog\LogOptions;
use Spatie\Activitylog\Traits\LogsActivity;

class Chantier extends Model
{
    /** @use HasFactory<ChantierFactory> */
    use HasFactory, LogsActivity, SoftDeletes;

    /** Statuts possibles (clé => libellé). */
    public const STATUSES = [
        'planned' => 'À venir',
        'active' => 'En cours',
        'paused' => 'Suspendu',
        'done' => 'Terminé',
    ];

    protected $fillable = [
        'name',
        'client',
        'address',
        'city',
        'color',
        'status',
        'start_date',
        'end_date',
        'notes',
    ];

    protected function casts(): array
    {
        return [
            'start_date' => 'date:Y-m-d',
            'end_date' => 'date:Y-m-d',
        ];
    }

    /** @return HasMany<Affectation, $this> */
    public function affectations(): HasMany
    {
        return $this->hasMany(Affectation::class);
    }

    /**
     * Recherche sur le nom, le client, l'adresse et la ville (?search=).
     *
     * @param  Builder<Chantier>  $query
     */
    public function scopeSearch(Builder $query, ?string $term): void
    {
        $term = trim((string) $term);
        if ($term === '') {
            return;
        }

        $query->where(function (Builder $q) use ($term) {
            $q->where('name', 'like', "%{$term}%")
                ->orWhere('client', 'like', "%{$term}%")
                ->orWhere('address', 'like', "%{$term}%")
                ->orWhere('city', 'like', "%{$term}%");
        });
    }

    /**
     * Chantiers planifiables (ni terminés, ni suspendus).
     *
     * @param  Builder<Chantier>  $query
     */
    public function scopeOpen(Builder $query): void
    {
        $query->whereIn('status', ['planned', 'active']);
    }

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()
            ->logOnly(['name', 'client', 'status', 'color', 'start_date', 'end_date'])
            ->logOnlyDirty()
            ->dontSubmitEmptyLogs();
    }
}
