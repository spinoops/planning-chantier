<?php

namespace Database\Factories;

use App\Models\Affectation;
use App\Models\Chantier;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Affectation>
 */
class AffectationFactory extends Factory
{
    public function definition(): array
    {
        return [
            'chantier_id' => Chantier::factory(),
            'date' => fake()->dateTimeBetween('-1 week', '+2 weeks')->format('Y-m-d'),
            'start_time' => '07:00',
            'end_time' => '16:30',
            'note' => fake()->optional(0.3)->sentence(),
        ];
    }
}
