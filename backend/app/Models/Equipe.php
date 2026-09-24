<?php

namespace App\Models;

use Database\Factories\EquipeFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Spatie\Activitylog\LogOptions;
use Spatie\Activitylog\Traits\LogsActivity;

/**
 * Équipe planifiable : un ou plusieurs employés, une couleur dans le calendrier.
 */
class Equipe extends Model
{
    /** @use HasFactory<EquipeFactory> */
    use HasFactory, LogsActivity;

    protected $fillable = ['name', 'color', 'sort_order'];

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

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()
            ->logOnly(['name', 'color'])
            ->logOnlyDirty()
            ->dontSubmitEmptyLogs();
    }
}
