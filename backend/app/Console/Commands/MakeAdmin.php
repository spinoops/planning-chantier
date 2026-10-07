<?php

namespace App\Console\Commands;

use App\Models\User;
use Database\Seeders\RolesSeeder;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Str;

/**
 * Crée (ou promeut) un compte administrateur, sans e-mail : mot de passe standard
 * (MakeStaff::DEFAULT_PASSWORD) ou celui de --password. Avec --mail, envoie plutôt le
 * lien pour définir le mot de passe.
 *
 *   php artisan planning:admin login@step-one.ch --name="Step One"
 */
class MakeAdmin extends Command
{
    protected $signature = 'planning:admin
                            {email : Adresse e-mail du compte}
                            {--name= : Nom affiché (création uniquement)}
                            {--password= : Mot de passe (défaut : mot de passe standard)}
                            {--mail : Envoyer le lien pour définir le mot de passe (au lieu du mot de passe standard)}';

    protected $description = 'Crée ou promeut un compte admin avec le mot de passe standard (sans e-mail).';

    public function handle(): int
    {
        $email = strtolower(trim((string) $this->argument('email')));
        if (! filter_var($email, FILTER_VALIDATE_EMAIL)) {
            $this->error("Adresse e-mail invalide : {$email}");

            return self::FAILURE;
        }

        $password = (string) ($this->option('password') ?: MakeStaff::DEFAULT_PASSWORD);
        if (strlen($password) < 8) {
            $this->error('Mot de passe trop court (8 caractères minimum).');

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
            $this->line("Compte créé : {$user->name} <{$email}>");
        }
        $user->forceFill(['email_verified_at' => $user->email_verified_at ?? now()])->save();

        $user->assignRole('admin');
        $this->info('Rôle admin attribué.');

        if (! $this->option('mail')) {
            $user->forceFill(['password' => Hash::make($password)])->save();
            $this->info('Mot de passe défini. Connexion possible tout de suite ; à changer ensuite dans « Mon profil ».');

            return self::SUCCESS;
        }

        $status = Password::sendResetLink(['email' => $email]);
        if ($status !== Password::RESET_LINK_SENT) {
            $this->error('Envoi du lien impossible : '.__($status).' (vérifier MAIL_* du .env, ou utiliser --password).');

            return self::FAILURE;
        }

        $this->info("Lien pour définir le mot de passe envoyé à {$email}.");

        return self::SUCCESS;
    }
}
