<?php

namespace Database\Factories;

use App\Models\Invitation;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Invitation>
 */
class InvitationFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'email' => fake()->unique()->safeEmail(),
            'token_hash' => Invitation::hashToken(Invitation::generateToken()),
            'role' => (string) config('roles.default', 'ouvrier'),
            'invited_by' => User::factory(),
            'expires_at' => now()->addDays(7),
        ];
    }

    /** Invitation dont le délai est dépassé. */
    public function expired(): static
    {
        return $this->state(fn () => ['expires_at' => now()->subDay()]);
    }

    /** Invitation déjà consommée. */
    public function accepted(): static
    {
        return $this->state(fn () => ['accepted_at' => now()]);
    }
}
