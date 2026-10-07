<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * Sous-traitant prévu sur un chantier (électricien, sanitaire, grutier…).
 */
class SousTraitant extends Model
{
    use HasFactory, SoftDeletes;

    protected $table = 'sous_traitants';

    protected $fillable = ['name', 'trade', 'contact_name', 'phone', 'email', 'notes'];

    /** @return BelongsToMany<Chantier, $this> */
    public function chantiers(): BelongsToMany
    {
        return $this->belongsToMany(Chantier::class, 'chantier_sous_traitant')->withPivot(['note', 'planned_date']);
    }

    /** @param  Builder<SousTraitant>  $query */
    public function scopeSearch(Builder $query, ?string $term): void
    {
        $term = trim((string) $term);
        if ($term === '') {
            return;
        }
        $query->where(function (Builder $q) use ($term) {
            $q->where('name', 'like', "%{$term}%")->orWhere('trade', 'like', "%{$term}%")->orWhere('contact_name', 'like', "%{$term}%");
        });
    }
}
