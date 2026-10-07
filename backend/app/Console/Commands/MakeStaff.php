<?php

namespace App\Console\Commands;

use App\Models\Equipe;
use App\Models\User;
use Database\Seeders\RolesSeeder;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Hash;

/**
 * Crée les comptes des employés de Top Stores avec un mot de passe commun, sans
 * e-mail : rôles, métier, couleur et équipe individuelle (comme leurs anciens
 * calendriers). Idempotent : un compte existant est mis à jour, rien n'est dupliqué.
 *
 *   php artisan planning:staff            (mot de passe standard)
 */
class MakeStaff extends Command
{
    protected $signature = 'planning:staff
                            {--password= : Mot de passe commun (défaut : mot de passe standard)}
                            {--domain=top-stores.ch : Domaine des adresses e-mail}';

    protected $description = 'Crée les comptes des employés (Robin, Davison, Léo, Étienne, David) avec un mot de passe commun.';

    /** Mot de passe standard des comptes créés en ligne (demande de l'utilisateur ; à changer dans « Mon profil »). */
    public const DEFAULT_PASSWORD = 'Test1234$';

    /** [identifiant e-mail, prénom, nom, rôles, métier, couleur de l'équipe] */
    private const STAFF = [
        ['robin', 'Robin', 'Braun', ['admin', 'chef'], 'Patron / chef de chantier', '#ef4444'],
        ['davison', 'Davison', 'Da Silva Setubal', ['gestionnaire'], 'Gestionnaire (bureau)', '#22c55e'],
        ['leo', 'Léo', 'Lançon', ['ouvrier'], 'Ouvrier', '#eab308'],
        ['etienne', 'Étienne', 'Armand', ['ouvrier'], 'Ouvrier', '#3b82f6'],
        ['david', 'David', 'Batista Setubal', ['ouvrier'], 'Ouvrier', '#a855f7'],
    ];

    public function handle(): int
    {
        $password = (string) ($this->option('password') ?: self::DEFAULT_PASSWORD);
        if (strlen($password) < 8) {
            $this->error('Mot de passe trop court (8 caractères minimum).');

            return self::FAILURE;
        }
        $domain = ltrim(strtolower(trim((string) $this->option('domain'))), '@');

        (new RolesSeeder)->run();

        foreach (self::STAFF as $i => [$login, $first, $last, $roles, $job, $color]) {
            $email = "{$login}@{$domain}";
            $equipe = Equipe::firstOrCreate(['name' => $first], ['color' => $color, 'sort_order' => $i]);

            $user = User::withTrashed()->where('email', $email)->first() ?? new User(['email' => $email]);
            if ($user->trashed()) {
                $user->restore();
            }
            $user->fill(['name' => "{$first} {$last}", 'job_title' => $job, 'color' => $color, 'equipe_id' => $equipe->id]);
            $user->forceFill(['password' => Hash::make($password), 'email_verified_at' => $user->email_verified_at ?? now()])->save();
            $user->syncRoles($roles);

            $this->line(sprintf('  %-28s %s', $email, implode(' + ', $roles)));
        }

        $this->info(count(self::STAFF).' comptes prêts, connexion possible tout de suite. Chacun peut changer son mot de passe dans « Mon profil ».');

        return self::SUCCESS;
    }
}
