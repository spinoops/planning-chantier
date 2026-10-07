<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Imprévu signalé depuis le chantier au bureau (absent demain, fini plus tôt, matériel…).
 */
class Signalement extends Model
{
    use HasFactory;

    public const TYPES = [
        'absence' => 'Absence / retard',
        'fin_anticipee' => 'Chantier terminé plus tôt',
        'materiel' => 'Matériel manquant',
        'autre' => 'Autre',
    ];

    protected $fillable = ['user_id', 'affectation_id', 'date', 'type', 'message', 'read_at', 'read_by'];

    protected function casts(): array
    {
        return [
            'date' => 'date:Y-m-d',
            'read_at' => 'datetime',
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

    /** @param  Builder<Signalement>  $query */
    public function scopeUnread(Builder $query): void
    {
        $query->whereNull('read_at');
    }
}
