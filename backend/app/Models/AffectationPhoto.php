<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Storage;

/**
 * Photo de fin de journée attachée à une affectation (disque public).
 */
class AffectationPhoto extends Model
{
    protected $fillable = ['affectation_id', 'user_id', 'path', 'caption'];

    /** @return BelongsTo<Affectation, $this> */
    public function affectation(): BelongsTo
    {
        return $this->belongsTo(Affectation::class);
    }

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** URL absolue (le front est servi depuis une autre origine que l'API). */
    public function url(): string
    {
        return url(Storage::disk('public')->url($this->path));
    }

    protected static function booted(): void
    {
        static::deleted(function (AffectationPhoto $photo) {
            Storage::disk('public')->delete($photo->path);
        });
    }
}
