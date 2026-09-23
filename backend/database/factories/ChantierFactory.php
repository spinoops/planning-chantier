<?php

namespace Database\Factories;

use App\Models\Chantier;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Chantier>
 */
class ChantierFactory extends Factory
{
    public const COLORS = ['#2563eb', '#ea580c', '#16a34a', '#9333ea', '#dc2626', '#0891b2', '#ca8a04', '#db2777', '#4f46e5', '#0d9488'];

    public function definition(): array
    {
        $start = fake()->dateTimeBetween('-2 months', '+1 month');

        return [
            'name' => ucfirst(fake()->words(2, true)),
            'client' => fake()->company(),
            'address' => fake()->streetAddress(),
            'city' => fake()->city(),
            'color' => fake()->randomElement(self::COLORS),
            'status' => 'active',
            'start_date' => $start->format('Y-m-d'),
            'end_date' => (clone $start)->modify('+'.fake()->numberBetween(2, 16).' weeks')->format('Y-m-d'),
            'notes' => fake()->optional()->sentence(),
        ];
    }

    public function done(): static
    {
        return $this->state(fn () => ['status' => 'done']);
    }
}
