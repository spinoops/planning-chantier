<?php

namespace Database\Seeders;

use App\Models\Absence;
use App\Models\Affectation;
use App\Models\Chantier;
use App\Models\Client;
use App\Models\Equipe;
use App\Models\Setting;
use App\Models\SousTraitant;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use Spatie\Permission\Models\Role;

class DatabaseSeeder extends Seeder
{
    /**
     * Rôles + comptes + équipes + jeu de données planning (idempotent).
     *
     * Identifiants (mot de passe : password) :
     *   admin@baseapp.test — administrateur
     *   robin@baseapp.test — Robin Braun, chef (planifie)
     *   leo@baseapp.test, davison@baseapp.test, etienne@baseapp.test, david@baseapp.test — ouvriers
     *
     * Chaque employé a son équipe (individuelle) avec la couleur de son calendrier.
     */
    public function run(): void
    {
        foreach (array_keys((array) config('roles.labels', [])) as $role) {
            Role::firstOrCreate(['name' => $role]);
        }

        if (Setting::query()->where('key', 'app_color')->doesntExist()) {
            Setting::setMany(['app_color' => '#007aff']);
        }

        $this->account('admin@baseapp.test', 'Admin', 'admin', ['job_title' => 'Direction', 'color' => '#111827']);

        // Employés : [email, prénom, nom, rôle, métier, couleur (= couleur de l'équipe)]
        $staff = [
            ['robin@baseapp.test', 'Robin', 'Braun', 'chef', 'Chef de chantier', '#ef4444'],
            ['leo@baseapp.test', 'Léo', 'Lançon', 'ouvrier', 'Ouvrier', '#eab308'],
            ['davison@baseapp.test', 'Davison', 'Da Silva Setubal', 'ouvrier', 'Bureau / atelier', '#22c55e'],
            ['etienne@baseapp.test', 'Étienne', 'Armand', 'ouvrier', 'Ouvrier', '#3b82f6'],
            ['david@baseapp.test', 'David', 'Batista Setubal', 'ouvrier', 'Ouvrier', '#a855f7'],
        ];

        $equipes = [];
        foreach ($staff as $i => [$email, $first, $last, $role, $job, $color]) {
            $equipe = Equipe::firstOrCreate(['name' => $first], ['color' => $color, 'sort_order' => $i]);
            $this->account($email, "{$first} {$last}", $role, [
                'job_title' => $job,
                'color' => $color,
                'phone' => '+41 79 300 20 '.str_pad((string) ($i + 1), 2, '0', STR_PAD_LEFT),
                'equipe_id' => $equipe->id,
            ]);
            $equipes[$first] = $equipe;
        }

        // Jeu de données planning : seulement si aucun chantier n'existe encore.
        if (Chantier::query()->exists()) {
            return;
        }

        $monday = CarbonImmutable::today()->startOfWeek();

        // Chantiers = clients, dans l'esprit des calendriers actuels (client + adresse).
        $chantiers = collect([
            ['Joray François', 'Rue des Pèlerins 35', 'Porrentruy', '#2563eb', 'active'],
            ['Chételat Nicolas', 'Chemin du Bruye 16', 'Courgenay', '#0891b2', 'active'],
            ['Migy Eloi', 'Dos les Laves 136', 'Alle', '#16a34a', 'active'],
            ['Varin Bernard', 'En Chaudron 4', 'Cornol', '#9333ea', 'active'],
            ['Rausis Gérard', 'Chemin de la Fiole 13', 'Fontenais', '#ea580c', 'active'],
            ['Regalo Celeste', 'Impasse en Cortio 3', 'Bressaucourt', '#db2777', 'planned'],
            ['Bureau', 'Atelier', 'Porrentruy', '#78716c', 'active'],
        ])->mapWithKeys(function (array $c) use ($monday) {
            // Un client par chantier (sauf le Bureau), avec les infos de la fiche de préparation.
            $client = $c[0] === 'Bureau' ? null : Client::firstOrCreate(['name' => $c[0]], ['address' => $c[1], 'city' => $c[2], 'phone' => '+41 32 466 00 00']);
            $isPlanned = $c[4] === 'planned';

            return [$c[0] => Chantier::create([
                'name' => $c[0],
                'client' => $client?->name,
                'client_id' => $client?->id,
                'address' => $c[1],
                'city' => $c[2],
                'color' => $c[3],
                'status' => $c[4],
                'start_date' => $monday->subWeeks(2)->toDateString(),
                'end_date' => $monday->addWeeks(8)->toDateString(),
                'estimated_hours' => $client ? 120 : null,
                'planning_hours' => $client && ! $isPlanned ? 110 : null,
                'quote_status' => $client ? ($isPlanned ? 'sent' : 'accepted') : 'none',
                'quote_amount' => $client ? 18500 : null,
                'quote_sent_at' => $client ? $monday->subWeeks(4)->toDateString() : null,
                'quote_accepted_at' => $client && ! $isPlanned ? $monday->subWeeks(3)->toDateString() : null,
                'remeasure_needed' => $isPlanned,
                'materiel' => $client ? [['label' => 'Béton C25/30', 'qty' => '6 m³', 'done' => ! $isPlanned], ['label' => 'Treillis', 'qty' => '12 panneaux', 'done' => false]] : null,
                'mesures' => $client ? 'Dalle 8.40 × 6.20 m, ép. 20 cm.' : null,
            ])];
        });

        // Un sous-traitant prévu sur le chantier à venir.
        $electricien = SousTraitant::firstOrCreate(['name' => 'Électro Jura Sàrl'], ['trade' => 'Électricien', 'phone' => '+41 32 466 11 22']);
        $chantiers['Regalo Celeste']->sousTraitants()->syncWithoutDetaching([$electricien->id => ['note' => 'Après la dalle', 'planned_date' => $monday->addWeeks(3)->toDateString()]]);

        $robin = User::where('email', 'robin@baseapp.test')->first();

        // Semaine courante et suivante : demi-journées par équipe, comme dans les calendriers.
        foreach ([0, 1] as $week) {
            $d = fn (int $day) => $monday->addWeeks($week)->addDays($day)->toDateString();

            // Léo : Joray lundi (journée), Chételat mardi matin, Vantaggiato… simplifié.
            $this->affect($chantiers['Joray François'], $equipes['Léo'], $d(0), '08:00', '12:00', $robin);
            $this->affect($chantiers['Joray François'], $equipes['Léo'], $d(0), '13:00', '14:45', $robin);
            $this->affect($chantiers['Regalo Celeste'], $equipes['Léo'], $d(0), '14:45', '17:00', $robin);
            $this->affect($chantiers['Chételat Nicolas'], $equipes['Léo'], $d(1), '08:00', '12:00', $robin);
            $this->affect($chantiers['Migy Eloi'], $equipes['Léo'], $d(3), '08:00', '12:00', $robin);
            $this->affect($chantiers['Migy Eloi'], $equipes['Léo'], $d(3), '13:00', '17:00', $robin);
            $this->affect($chantiers['Varin Bernard'], $equipes['Léo'], $d(4), '08:00', '12:00', $robin);

            // Étienne et David : ensemble chez Rausis, puis Varin — une seule carte par chantier
            // et par créneau, avec les deux personnes dedans (pas une carte par équipe).
            $duo = [$equipes['Étienne'], $equipes['David']];
            $this->affect($chantiers['Rausis Gérard'], $duo, $d(0), '07:30', '12:00', $robin);
            $this->affect($chantiers['Rausis Gérard'], $duo, $d(0), '13:00', '16:45', $robin);
            $this->affect($chantiers['Rausis Gérard'], $duo, $d(1), '07:30', '12:00', $robin);
            $this->affect($chantiers['Varin Bernard'], $duo, $d(2), '07:30', '16:45', $robin, 'Prendre la remorque.');
            $this->affect($chantiers['Chételat Nicolas'], $duo, $d(3), '07:30', '16:45', $robin);
            $this->affect($chantiers['Migy Eloi'], $duo, $d(4), '07:30', '12:00', $robin);

            // Davison : bureau / atelier.
            for ($day = 0; $day < 5; $day++) {
                $this->affect($chantiers['Bureau'], $equipes['Davison'], $d($day), '07:30', '11:45', $robin);
                $this->affect($chantiers['Bureau'], $equipes['Davison'], $d($day), '13:15', '17:30', $robin);
            }

            // Robin : passages sur les chantiers.
            $this->affect($chantiers['Rausis Gérard'], $equipes['Robin'], $d(2), '08:00', '13:00', $robin, 'Contrôle et métrés.');
            $this->affect($chantiers['Joray François'], $equipes['Robin'], $d(0), '10:30', '12:00', $robin);
            $this->affect($chantiers['Bureau'], $equipes['Robin'], $d(3), '07:45', '09:30', $robin, 'Devis et téléphones.');
        }

        // Une absence de démo : Léo en vacances la semaine +2 (grisé dans le planning).
        Absence::firstOrCreate(
            ['user_id' => User::where('email', 'leo@baseapp.test')->value('id'), 'start_date' => $monday->addWeeks(2)->toDateString()],
            ['end_date' => $monday->addWeeks(2)->addDays(4)->toDateString(), 'type' => 'vacances', 'note' => 'Vacances', 'created_by' => $robin->id],
        );
    }

    /**
     * Crée ou met à jour un compte de démo avec son rôle.
     *
     * @param  array<string, mixed>  $extra
     */
    private function account(string $email, string $name, string $role, array $extra = []): User
    {
        $user = User::updateOrCreate(
            ['email' => $email],
            [
                'name' => $name,
                'password' => Hash::make('password'),
                'email_verified_at' => now(),
                ...$extra,
            ]
        );
        $user->syncRoles([$role]);

        return $user;
    }

    /**
     * Une affectation = un chantier sur un créneau. Avec plusieurs équipes, les membres sont
     * réunis dans la même carte (equipe_id vide : personnes choisies une à une).
     *
     * @param  Equipe|Equipe[]  $equipes
     */
    private function affect(Chantier $chantier, Equipe|array $equipes, string $date, string $start, string $end, User $author, ?string $note = null): void
    {
        $equipes = is_array($equipes) ? array_values($equipes) : [$equipes];
        $affectation = Affectation::create([
            'chantier_id' => $chantier->id,
            'equipe_id' => count($equipes) === 1 ? $equipes[0]->id : null,
            'date' => $date,
            'start_time' => $start,
            'end_time' => $end,
            'note' => $note,
            'created_by' => $author->id,
        ]);
        $members = collect($equipes)->flatMap(fn (Equipe $e) => $e->members()->pluck('users.id'))->unique()->values();
        $affectation->workers()->sync($members);
    }
}
