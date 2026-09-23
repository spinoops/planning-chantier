<?php

namespace App\Support;

use App\Models\Setting;

/**
 * État (activé / désactivé) des modules optionnels de l'application.
 *
 * Les définitions vivent dans config/modules.php ; l'état choisi par l'admin
 * est stocké dans la table `settings` sous des clés `module.<clé>`.
 */
class Modules
{
    /** Préfixe des clés de réglage stockant l'état des modules. */
    private const PREFIX = 'module.';

    /**
     * Liste complète des modules : métadonnées + état effectif.
     *
     * @return list<array{key: string, name: string, description: string, available: bool, enabled: bool}>
     */
    public static function all(): array
    {
        $overrides = Setting::query()
            ->where('key', 'like', self::PREFIX.'%')
            ->pluck('value', 'key');

        $modules = [];

        foreach ((array) config('modules', []) as $key => $definition) {
            $stored = $overrides->get(self::PREFIX.$key);
            $available = (bool) ($definition['available'] ?? true);
            $enabled = $stored !== null
                ? $stored === '1'
                : (bool) ($definition['default'] ?? false);

            $modules[] = [
                'key' => $key,
                'name' => $definition['name'] ?? $key,
                'description' => $definition['description'] ?? '',
                'available' => $available,
                'enabled' => $available && $enabled,
            ];
        }

        return $modules;
    }

    /**
     * Carte clé => activé, exposée au front (menu, gardes de route).
     *
     * @return array<string, bool>
     */
    public static function enabledMap(): array
    {
        $map = [];
        foreach (self::all() as $module) {
            $map[$module['key']] = $module['enabled'];
        }

        return $map;
    }

    public static function isEnabled(string $key): bool
    {
        return self::enabledMap()[$key] ?? false;
    }

    /**
     * Active ou désactive des modules. Les clés inconnues sont ignorées.
     *
     * @param  array<string, bool>  $states
     */
    public static function setMany(array $states): void
    {
        $known = array_keys((array) config('modules', []));

        foreach ($states as $key => $enabled) {
            if (! in_array($key, $known, true)) {
                continue;
            }

            Setting::updateOrCreate(
                ['key' => self::PREFIX.$key],
                ['value' => $enabled ? '1' : '0'],
            );
        }
    }
}
