<?php

namespace App\Console\Commands;

use App\Models\Affectation;
use App\Models\Setting;
use App\Models\User;
use App\Notifications\AffectationReminderNotification;
use Carbon\CarbonImmutable;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/**
 * Rappels push avant le début des chantiers.
 *
 * Tourne chaque minute (schedule). Pour chaque personne qui a des appareils abonnés et
 * un délai `notify_before_minutes` > 0, on cherche ses affectations qui commencent dans
 * exactement ce délai (avec quelques minutes de tolérance si le cron a sauté un tour).
 * La table `affectation_reminders` garantit un seul rappel par affectation et par personne.
 */
class SendPlanningReminders extends Command
{
    protected $signature = 'planning:remind {--grace=5 : Tolérance en minutes si le cron a pris du retard}';

    protected $description = 'Envoie les rappels push « Dans 1 h : chantier X » aux personnes affectées';

    public function handle(): int
    {
        $now = CarbonImmutable::now()->startOfMinute();
        $grace = max(0, (int) $this->option('grace'));
        $morning = Setting::get('planning_morning_start', '07:30') ?: '07:30';

        $users = User::query()
            ->where('notify_before_minutes', '>', 0)
            ->whereHas('pushSubscriptions')
            ->get();

        $sent = 0;
        foreach ($users as $user) {
            $target = $now->addMinutes((int) $user->notify_before_minutes);
            $windowStart = $target->subMinutes($grace);

            $affectations = Affectation::query()
                ->with(['chantier', 'people'])
                ->whereHas('chantier')
                ->whereHas('people', fn ($q) => $q->where('users.id', $user->id))
                ->whereDate('date', $target->toDateString())
                ->get()
                ->filter(function (Affectation $a) use ($windowStart, $target, $morning) {
                    $start = $a->start_time ? substr($a->start_time, 0, 5) : $morning;
                    $at = CarbonImmutable::parse($a->date->toDateString().' '.$start);

                    return $at->gt($windowStart) && $at->lte($target);
                });

            foreach ($affectations as $affectation) {
                $inserted = DB::table('affectation_reminders')->insertOrIgnore([
                    'affectation_id' => $affectation->id,
                    'user_id' => $user->id,
                    'sent_at' => now(),
                ]);
                if (! $inserted) {
                    continue; // déjà rappelé
                }
                $user->notify(new AffectationReminderNotification($affectation, (int) $user->notify_before_minutes));
                $sent++;
            }
        }

        $this->info($sent.' rappel(s) envoyé(s).');

        return self::SUCCESS;
    }
}
