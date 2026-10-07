<?php

namespace App\Models;

use Database\Factories\EquipeFactory;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Spatie\Activitylog\LogOptions;
use Spatie\Activitylog\Traits\LogsActivity;

/**
 * Équipe planifiable : un ou plusieurs employés, une couleur dans le calendrier.
 * Une équipe temporaire (binôme d'une semaine) porte une date d'expiration :
 * elle disparaît ensuite de la colonne du planning.
 */
class Equipe extends Model
{
    /** @use HasFactory<EquipeFactory> */
    use HasFactory, LogsActivity;

    protected $fillable = ['name', 'color', 'sort_order', 'expires_at'];

    protected function casts(): array
    {
        return [
            'expires_at' => 'date:Y-m-d',
        ];
    }

    /** Employés rattachés (un employé n'a qu'une équipe). @return HasMany<User, $this> */
    public function members(): HasMany
    {
        return $this->hasMany(User::class)->orderBy('name');
    }

    /** @return HasMany<Affectation, $this> */
    public function affectations(): HasMany
    {
        return $this->hasMany(Affectation::class);
    }

    /**
     * Équipes encore valables (pas d'expiration ou expiration future).
     *
     * @param  Builder<Equipe>  $query
     */
    public function scopeActive(Builder $query): void
    {
        $query->where(fn (Builder $q) => $q->whereNull('expires_at')->orWhereDate('expires_at', '>=', now()->toDateString()));
    }

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()
            ->logOnly(['name', 'color', 'expires_at'])
            ->logOnlyDirty()
            ->dontSubmitEmptyLogs();
    }
}
