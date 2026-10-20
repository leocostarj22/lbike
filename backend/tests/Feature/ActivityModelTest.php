<?php

namespace Tests\Feature;

use App\Models\Activity;
use App\Models\ActivityPoint;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ActivityModelTest extends TestCase
{
    use RefreshDatabase;

    public function test_an_activity_belongs_to_a_user_and_orders_its_points(): void
    {
        $user = User::factory()->create();
        $activity = Activity::create([
            'user_id' => $user->id,
            'type' => 'cycling',
            'started_at' => now(),
            'distance_meters' => 1200.5,
            'duration_seconds' => 300,
            'moving_seconds' => 300,
            'visibility' => 'private',
        ]);

        ActivityPoint::create(['activity_id' => $activity->id, 'sequence' => 1, 'lat' => 38.72, 'lng' => -9.14, 'recorded_at' => now()]);
        ActivityPoint::create(['activity_id' => $activity->id, 'sequence' => 0, 'lat' => 38.71, 'lng' => -9.13, 'recorded_at' => now()]);

        $this->assertTrue($activity->user->is($user));
        $this->assertCount(1, $user->activities);
        $this->assertEquals([0, 1], $activity->points->pluck('sequence')->all());
    }
}
