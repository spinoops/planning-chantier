<?php

namespace Database\Seeders;

use App\Models\Affectation;
use App\Models\Chantier;
use App\Models\Setting;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use Spatie\Permission\Models\Role;

class DatabaseSeeder extends Seeder
{
    /**
     * Rôles + comptes de démonstration + jeu de données planning (idempotent).
     *
     * Identifiants (mot de passe : password) :
     *   admin@baseapp.test   — administrateur
     *   chef@baseapp.test    — chef de chantier (planifie)
     *   ouvrier@baseapp.test — ouvrier (voit son planning)
     */
    public function run(): void
    {
        foreach (array_keys((array) config('roles.labels', [])) as $role) {
            Role::firstOrCreate(['name' => $role]);
        }

        // Identité par défaut de l'app (modifiable dans Configuration).
        if (Setting::query()->where('key', 'app_color')->doesntExist()) {
            Setting::setMany(['app_color' => '#ea580c']);
        }

        $admin = $this->account('admin@baseapp.test', 'Admin', 'admin', ['job_title' => 'Direction', 'color' => '#111827']);

        $chef = $this->account('chef@baseapp.test', 'Marc Favre', 'chef', [
            'job_title' => 'Chef de chantier',
            'phone' => '+41 79 200 10 01',
            'color' => '#0f766e',
        ]);

        $workers = collect([
            ['ouvrier@baseapp.test', 'Luca Bernasconi', 'Maçon', '#2563eb'],
            ['j.dupont@baseapp.test', 'Julien Dupont', 'Maçon', '#7c3aed'],
            ['a.rossi@baseapp.test', 'Andrea Rossi', 'Coffreur', '#db2777'],
            ['s.meier@baseapp.test', 'Samuel Meier', 'Grutier', '#ca8a04'],
            ['n.silva@baseapp.test', 'Nuno Silva', 'Manœuvre', '#16a34a'],
            ['k.oliveira@baseapp.test', 'Karim Oliveira', 'Ferrailleur', '#dc2626'],
            ['t.girard@baseapp.test', 'Thomas Girard', 'Apprenti', '#0891b2'],
        ])->map(fn (array $w, int $i) => $this->account($w[0], $w[1], 'ouvrier', [
            'job_title' => $w[2],
            'color' => $w[3],
            'phone' => '+41 79 300 20 '.str_pad((string) ($i + 1), 2, '0', STR_PAD_LEFT),
        ]));

        // Jeu de données planning : seulement si aucun chantier n'existe encore.
        if (Chantier::query()->exists()) {
            return;
        }

        $monday = CarbonImmutable::today()->startOfWeek();

        $chantiers = collect([
            ['Villa Les Cèdres', 'Famille Roulet', 'Chemin des Cèdres 12', 'Lausanne', '#2563eb', 'active', -6, 10],
            ['Immeuble Rue du Lac', 'Régie Lémanique SA', 'Rue du Lac 45', 'Vevey', '#ea580c', 'active', -10, 20],
            ['Rénovation école', 'Commune de Pully', 'Avenue de Lavaux 8', 'Pully', '#16a34a', 'active', -2, 6],
            ['Halle industrielle', 'Logistique Plus SA', 'Route de Genève 120', 'Crissier', '#9333ea', 'planned', 2, 14],
            ['Mur de soutènement', 'M. Perrin', 'Route du Village 3', 'Cully', '#0891b2', 'done', -12, -2],
        ])->map(fn (array $c) => Chantier::create([
            'name' => $c[0],
            'client' => $c[1],
            'address' => $c[2],
            'city' => $c[3],
            'color' => $c[4],
            'status' => $c[5],
            'start_date' => $monday->addWeeks($c[6])->toDateString(),
            'end_date' => $monday->addWeeks($c[7])->toDateString(),
        ]));

        [$villa, $immeuble, $ecole, $halle] = $chantiers;
        $ids = $workers->pluck('id')->values();

        // Semaine précédente, courante et suivante : équipes stables du lundi au vendredi.
        foreach ([-1, 0, 1] as $week) {
            for ($d = 0; $d < 5; $d++) {
                $date = $monday->addWeeks($week)->addDays($d)->toDateString();

                $this->affect($villa, $date, '07:00', '16:30', [$ids[0], $ids[1], $ids[6]], $chef, $d === 0 ? 'Livraison béton 8h.' : null);
                $this->affect($immeuble, $date, '07:00', '17:00', [$ids[2], $ids[3], $ids[5], $chef->id], $chef);

                if ($d < 3) {
                    $this->affect($ecole, $date, '08:00', '16:00', [$ids[4]], $chef, $d === 2 ? 'Fin des travaux de démolition.' : null);
                } else {
                    $this->affect($villa, $date, '13:00', '16:30', [$ids[4]], $chef, 'Renfort après-midi.');
                }
            }
        }

        // Semaine +2 : démarrage de la halle, un jour de préparation.
        $this->affect($halle, $monday->addWeeks(2)->toDateString(), '07:30', '12:00', [$chef->id, $ids[3], $ids[4]], $chef, 'Implantation et installation de chantier.');
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
     * @param  list<int>  $workerIds
     */
    private function affect(Chantier $chantier, string $date, string $start, string $end, array $workerIds, User $author, ?string $note = null): void
    {
        $affectation = Affectation::create([
            'chantier_id' => $chantier->id,
            'date' => $date,
            'start_time' => $start,
            'end_time' => $end,
            'note' => $note,
            'created_by' => $author->id,
        ]);
        $affectation->workers()->sync($workerIds);
    }
}
