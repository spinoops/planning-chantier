<?php

namespace Database\Factories;

use App\Models\Equipe;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Equipe>
 */
class EquipeFactory extends Factory
{
    public function definition(): array
    {
        return [
            'name' => 'Équipe '.fake()->unique()->firstName(),
            'color' => fake()->randomElement(ChantierFactory::COLORS),
            'sort_order' => 0,
        ];
    }
}
