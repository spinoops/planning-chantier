<?php

namespace App\Providers;

use App\Models\User;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\ServiceProvider;
use Laravel\Telescope\TelescopeServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        // Telescope est installé en dépendance --dev : on ne le charge qu'en local
        // et seulement si le paquet est présent (absent en production).
        if ($this->app->environment('local') && class_exists(TelescopeServiceProvider::class)) {
            $this->app->register(TelescopeServiceProvider::class);
            $this->app->register(\App\Providers\TelescopeServiceProvider::class);
        }
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // Un administrateur passe toutes les Policies / Gates (même convention
        // côté front : lib/roles.ts → can()). Renvoyer null laisse la Policy décider.
        Gate::before(fn (User $user) => $user->isAdmin() ? true : null);

        // Le lien de réinitialisation de mot de passe pointe vers la SPA React.
        ResetPassword::createUrlUsing(function ($notifiable, string $token) {
            return config('app.frontend_url')
                .'/reset-password?token='.$token
                .'&email='.urlencode($notifiable->getEmailForPasswordReset());
        });
    }
}
