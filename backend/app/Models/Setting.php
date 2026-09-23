<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Setting extends Model
{
    protected $fillable = ['key', 'value'];

    /**
     * Réglages d'identité exposés à l'app, avec leurs valeurs par défaut.
     * Toute nouvelle clé ajoutée ici devient disponible automatiquement
     * (pense à l'ajouter aussi dans UpdateSettingsRequest et le front).
     *
     * @return array<string, string>
     */
    public static function defaults(): array
    {
        return [
            // Le nom par défaut suit APP_NAME (.env) : un projet dérivé affiche
            // son propre nom sans passer par la page Configuration.
            'app_name' => (string) config('app.name', 'Baseapp'),
            'app_logo_url' => '',
            'app_color' => '#4f46e5',
        ];
    }

    /**
     * Tous les réglages sous forme clé => valeur, complétés par les défauts.
     * Les clés techniques (`module.*`, gérées par App\Support\Modules) sont exclues.
     *
     * @return array<string, string>
     */
    public static function allAsArray(): array
    {
        $stored = self::query()
            ->where('key', 'not like', 'module.%')
            ->pluck('value', 'key')
            ->all();

        return array_merge(self::defaults(), $stored);
    }

    /**
     * Valeur d'un réglage (ou son défaut).
     */
    public static function get(string $key, ?string $default = null): ?string
    {
        return self::query()->where('key', $key)->value('value')
            ?? self::defaults()[$key]
            ?? $default;
    }

    /**
     * Crée ou met à jour une liste de réglages.
     *
     * @param  array<string, string|null>  $values
     */
    public static function setMany(array $values): void
    {
        foreach ($values as $key => $value) {
            self::updateOrCreate(['key' => $key], ['value' => $value]);
        }
    }
}
