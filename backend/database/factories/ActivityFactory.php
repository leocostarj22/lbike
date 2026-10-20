<?php

namespace Database\Factories;

use App\Models\Activity;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Activity>
 */
class ActivityFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'user_id' => User::factory(),
            'type' => 'cycling',
            'started_at' => now(),
            'distance_meters' => 1000,
            'duration_seconds' => 300,
            'moving_seconds' => 300,
            'visibility' => 'private',
        ];
    }
}
