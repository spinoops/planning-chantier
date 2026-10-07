<?php

namespace App\Console\Commands;

use App\Models\User;
use Database\Seeders\RolesSeeder;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Str;

/**
 * Crée (ou promeut) un compte administrateur et lui envoie le lien pour définir
 * son mot de passe. Aucun mot de passe ne passe par la ligne de commande ni par
 * l'historique du shell. Sert à créer le premier compte en production, où le
 * seeder ne crée aucun compte de démo.
 *
 *   php artisan planning:admin login@step-one.ch --name="Step One"
 */
class MakeAdmin extends Command
{
    protected $signature = 'planning:admin
                            {email : Adresse e-mail du compte}
                            {--name= : Nom affiché (création uniquement)}
                            {--no-mail : Ne pas envoyer le lien de mot de passe}';

    protected $description = 'Crée ou promeut un compte admin et envoie le lien pour définir son mot de passe.';

    public function handle(): int
    {
        $email = strtolower(trim((string) $this->argument('email')));
        if (! filter_var($email, FILTER_VALIDATE_EMAIL)) {
            $this->error("Adresse e-mail invalide : {$email}");

            return self::FAILURE;
        }

        (new RolesSeeder)->run();

        $user = User::withTrashed()->where('email', $email)->first();
        if ($user) {
            if ($user->trashed()) {
                $user->restore();
            }
            $this->line("Compte existant : {$user->name} <{$email}>");
        } else {
            $user = User::create([
                'name' => trim((string) $this->option('name')) ?: $email,
                'email' => $email,
                'password' => Hash::make(Str::random(40)),
            ]);
            $user->forceFill(['email_verified_at' => now()])->save();
            $this->line("Compte créé : {$user->name} <{$email}>");
        }

        $user->assignRole('admin');
        $this->info('Rôle admin attribué.');

        if ($this->option('no-mail')) {
            $this->comment('Aucun e-mail envoyé (--no-mail). Utiliser « Mot de passe oublié ? » pour définir le mot de passe.');

            return self::SUCCESS;
        }

        $status = Password::sendResetLink(['email' => $email]);
        if ($status !== Password::RESET_LINK_SENT) {
            $this->error('Envoi du lien impossible : '.__($status).' (vérifier la config MAIL_* du .env).');

            return self::FAILURE;
        }

        $this->info("Lien pour définir le mot de passe envoyé à {$email}.");

        return self::SUCCESS;
    }
}
