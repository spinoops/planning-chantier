<?php

namespace Database\Seeders;

use App\Models\Absence;
use App\Models\Affectation;
use App\Models\Chantier;
use App\Models\Client;
use App\Models\Equipe;
use App\Models\Setting;
use App\Models\SousTraitant;
use App\Models\TimeEntry;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    /** Mot de passe des comptes employés de démo (le compte Admin garde « password »). */
    public const STAFF_PASSWORD = 'Test1234$';

    /**
     * Rôles + comptes + équipes + jeu de données planning (idempotent).
     *
     * Identifiants (mot de passe : password) :
     *   admin@baseapp.test — administrateur
     *   robin@baseapp.test — Robin Braun, patron : admin + chef (planifie, passe sur les chantiers)
     *   davison@baseapp.test — Davison Da Silva Setubal, gestionnaire (bureau : prépare et planifie)
     *   leo@baseapp.test, etienne@baseapp.test, david@baseapp.test — ouvriers
     *
     * Chaque employé a son équipe (individuelle) avec la couleur de son calendrier.
     */
    public function run(): void
    {
        $this->call(RolesSeeder::class);

        // Jamais de comptes ni de données de démo en production (mots de passe connus).
        // Premier compte en ligne : php artisan planning:admin <email>.
        if (app()->isProduction()) {
            return;
        }

        if (Setting::query()->where('key', 'app_color')->doesntExist()) {
            Setting::setMany(['app_color' => '#e30917']);
        }

        $this->account('admin@baseapp.test', 'Admin', 'admin', ['job_title' => 'Direction', 'color' => '#111827']);

        // Employés : [email, prénom, nom, rôle(s), métier, couleur (= couleur de l'équipe)]
        $staff = [
            ['robin@baseapp.test', 'Robin', 'Braun', ['admin', 'chef'], 'Patron / chef de chantier', '#ef4444'],
            ['leo@baseapp.test', 'Léo', 'Lançon', 'ouvrier', 'Ouvrier', '#eab308'],
            ['davison@baseapp.test', 'Davison', 'Da Silva Setubal', 'gestionnaire', 'Gestionnaire (bureau)', '#22c55e'],
            ['etienne@baseapp.test', 'Étienne', 'Armand', 'ouvrier', 'Ouvrier', '#3b82f6'],
            ['david@baseapp.test', 'David', 'Batista Setubal', 'ouvrier', 'Ouvrier', '#a855f7'],
        ];

        $equipes = [];
        foreach ($staff as $i => [$email, $first, $last, $role, $job, $color]) {
            $equipe = Equipe::firstOrCreate(['name' => $first], ['color' => $color, 'sort_order' => $i]);
            $this->account($email, "{$first} {$last}", $role, [
                'password' => self::STAFF_PASSWORD,
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

        // Chantiers = clients fictifs (client + adresse) : ces données apparaissent dans les captures
        // du mode d'emploi, publiques. Ne pas y mettre de vrais clients.
        $chantiers = collect([
            ['Dubois Claire', 'Rue des Tilleuls 12', 'Porrentruy', '#2563eb', 'active'],
            ['Fontaine Marc', 'Chemin des Vergers 5', 'Courgenay', '#0891b2', 'active'],
            ['Girard Julie', 'Route de la Gare 21', 'Alle', '#16a34a', 'active'],
            ['Lambert Paul', 'Rue du Moulin 4', 'Cornol', '#9333ea', 'active'],
            ['Morel Sophie', 'Chemin des Prés 13', 'Fontenais', '#ea580c', 'active'],
            ['Perrin Lucas', 'Impasse des Saules 3', 'Bressaucourt', '#db2777', 'planned'],
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
        $chantiers['Perrin Lucas']->sousTraitants()->syncWithoutDetaching([$electricien->id => ['note' => 'Après la dalle', 'planned_date' => $monday->addWeeks(3)->toDateString()]]);

        $robin = User::where('email', 'robin@baseapp.test')->first();

        // Semaine précédente, courante et suivante : demi-journées par équipe, comme dans les calendriers.
        foreach ([-1, 0, 1] as $week) {
            $d = fn (int $day) => $monday->addWeeks($week)->addDays($day)->toDateString();

            // Léo : Dubois lundi (journée), Fontaine mardi matin, etc.
            $this->affect($chantiers['Dubois Claire'], $equipes['Léo'], $d(0), '08:00', '12:00', $robin);
            $this->affect($chantiers['Dubois Claire'], $equipes['Léo'], $d(0), '13:00', '14:45', $robin);
            $this->affect($chantiers['Perrin Lucas'], $equipes['Léo'], $d(0), '14:45', '17:00', $robin);
            $this->affect($chantiers['Fontaine Marc'], $equipes['Léo'], $d(1), '08:00', '12:00', $robin);
            $this->affect($chantiers['Girard Julie'], $equipes['Léo'], $d(3), '08:00', '12:00', $robin);
            $this->affect($chantiers['Girard Julie'], $equipes['Léo'], $d(3), '13:00', '17:00', $robin);
            $this->affect($chantiers['Lambert Paul'], $equipes['Léo'], $d(4), '08:00', '12:00', $robin);

            // Étienne et David : ensemble chez Morel, puis Lambert — une seule carte par chantier
            // et par créneau, avec les deux personnes dedans (pas une carte par équipe).
            $duo = [$equipes['Étienne'], $equipes['David']];
            $this->affect($chantiers['Morel Sophie'], $duo, $d(0), '07:30', '12:00', $robin);
            $this->affect($chantiers['Morel Sophie'], $duo, $d(0), '13:00', '16:45', $robin);
            $this->affect($chantiers['Morel Sophie'], $duo, $d(1), '07:30', '12:00', $robin);
            $this->affect($chantiers['Lambert Paul'], $duo, $d(2), '07:30', '16:45', $robin, 'Prendre la remorque.');
            $this->affect($chantiers['Fontaine Marc'], $duo, $d(3), '07:30', '16:45', $robin);
            $this->affect($chantiers['Girard Julie'], $duo, $d(4), '07:30', '12:00', $robin);

            // Davison : bureau / atelier.
            for ($day = 0; $day < 5; $day++) {
                $this->affect($chantiers['Bureau'], $equipes['Davison'], $d($day), '07:30', '11:45', $robin);
                $this->affect($chantiers['Bureau'], $equipes['Davison'], $d($day), '13:15', '17:30', $robin);
            }

            // Robin : passages sur les chantiers.
            $this->affect($chantiers['Morel Sophie'], $equipes['Robin'], $d(2), '08:00', '13:00', $robin, 'Contrôle et métrés.');
            $this->affect($chantiers['Dubois Claire'], $equipes['Robin'], $d(0), '10:30', '12:00', $robin);
            $this->affect($chantiers['Bureau'], $equipes['Robin'], $d(3), '07:45', '09:30', $robin, 'Devis et téléphones.');
        }

        $this->seedTimeEntries($monday, $robin);

        // Une absence de démo : Léo en vacances la semaine +2 (grisé dans le planning).
        Absence::firstOrCreate(
            ['user_id' => User::where('email', 'leo@baseapp.test')->value('id'), 'start_date' => $monday->addWeeks(2)->toDateString()],
            ['end_date' => $monday->addWeeks(2)->addDays(4)->toDateString(), 'type' => 'vacances', 'note' => 'Vacances', 'created_by' => $robin->id],
        );
    }

    /**
     * Pointages de démo pour la rubrique Statistiques → Heures : chaque affectation passée
     * est pointée selon le planning (à ±15 min près, pause de 45 min si elle couvre midi).
     * Semaine précédente validée, semaine courante soumise, hier encore en brouillon,
     * plus un oubli (Léo, mardi) et une longue journée (David, mercredi dernier) à contrôler.
     */
    private function seedTimeEntries(CarbonImmutable $monday, User $robin): void
    {
        $today = CarbonImmutable::today();
        $yesterday = $today->subDay()->toDateString();
        $forgotten = [User::where('email', 'leo@baseapp.test')->value('id'), $monday->addDay()->toDateString()];
        $longDay = [User::where('email', 'david@baseapp.test')->value('id'), $monday->subWeek()->addDays(2)->toDateString()];

        $past = Affectation::with('people')
            ->whereDate('date', '<', $today->toDateString())
            ->whereNotNull('start_time')
            ->whereNotNull('end_time')
            ->orderBy('date')
            ->get();

        foreach ($past as $a) {
            $date = $a->date->toDateString();
            foreach ($a->people as $person) {
                if ($person->pivot->role !== 'worker' || [$person->id, $date] === $forgotten) {
                    continue;
                }
                $start = substr($a->start_time, 0, 5);
                $end = CarbonImmutable::parse($date.' '.substr($a->end_time, 0, 5))->addMinutes([0, 15, -15][($a->id + $person->id) % 3]);
                if ([$person->id, $date] === $longDay) {
                    $end = CarbonImmutable::parse($date.' 19:00');
                }
                $spansLunch = $start < '12:00' && $end->format('H:i') > '13:00';
                $status = $date < $monday->toDateString() ? 'validated' : ($date === $yesterday ? 'draft' : 'submitted');

                TimeEntry::create([
                    'user_id' => $person->id,
                    'affectation_id' => $a->id,
                    'chantier_id' => $a->chantier_id,
                    'date' => $date,
                    'start_time' => $start,
                    'end_time' => $end->format('H:i'),
                    'break_minutes' => $spansLunch ? 45 : 0,
                    'status' => $status,
                    'validated_by' => $status === 'validated' ? $robin->id : null,
                    'validated_at' => $status === 'validated' ? $monday->subDay()->setTime(17, 0) : null,
                ]);
            }
        }
    }

    /**
     * Crée ou met à jour un compte de démo avec son rôle.
     *
     * @param  array<string, mixed>  $extra
     */
    /**
     * @param  string|string[]  $roles
     */
    private function account(string $email, string $name, string|array $roles, array $extra = []): User
    {
        $password = $extra['password'] ?? 'password';
        unset($extra['password']);

        $user = User::updateOrCreate(
            ['email' => $email],
            [
                'name' => $name,
                'password' => Hash::make($password),
                'email_verified_at' => now(),
                ...$extra,
            ]
        );
        $user->syncRoles((array) $roles);

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
