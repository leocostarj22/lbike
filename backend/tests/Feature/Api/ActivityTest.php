<?php

namespace Tests\Feature\Api;

use App\Models\Activity;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ActivityTest extends TestCase
{
    use RefreshDatabase;

    private function authHeader(User $user): array
    {
        return ['Authorization' => 'Bearer '.$user->createToken('test')->plainTextToken];
    }

    public function test_store_creates_an_activity_with_its_points(): void
    {
        $user = User::factory()->create();

        $response = $this->withHeaders($this->authHeader($user))->postJson('/api/v1/activities', [
            'type' => 'cycling',
            'started_at' => now()->toIso8601String(),
            'distance_meters' => 1500.2,
            'duration_seconds' => 400,
            'moving_seconds' => 400,
            'title' => 'Volta no parque',
            'points' => [
                ['lat' => 38.71, 'lng' => -9.13, 'recorded_at' => now()->toIso8601String()],
                ['lat' => 38.72, 'lng' => -9.14, 'recorded_at' => now()->addSeconds(10)->toIso8601String()],
            ],
        ]);

        $response->assertCreated()->assertJsonPath('activity.title', 'Volta no parque');
        $this->assertDatabaseCount('activity_points', 2);
        $this->assertEquals('private', Activity::first()->visibility);
    }

    public function test_store_rejects_fewer_than_two_points(): void
    {
        $user = User::factory()->create();

        $response = $this->withHeaders($this->authHeader($user))->postJson('/api/v1/activities', [
            'type' => 'cycling',
            'started_at' => now()->toIso8601String(),
            'distance_meters' => 0,
            'duration_seconds' => 5,
            'moving_seconds' => 5,
            'points' => [['lat' => 38.71, 'lng' => -9.13, 'recorded_at' => now()->toIso8601String()]],
        ]);

        $response->assertStatus(422);
    }

    public function test_index_returns_only_the_authenticated_users_activities(): void
    {
        $user = User::factory()->create();
        $other = User::factory()->create();
        Activity::factory()->for($user)->create(['title' => 'Minha']);
        Activity::factory()->for($other)->create(['title' => 'Da outra pessoa']);

        $response = $this->withHeaders($this->authHeader($user))->getJson('/api/v1/activities');

        $response->assertOk();
        $this->assertCount(1, $response->json('activities'));
        $response->assertJsonPath('activities.0.title', 'Minha');
    }

    public function test_show_returns_the_activity_with_its_points(): void
    {
        $user = User::factory()->create();
        $activity = Activity::factory()->for($user)->create();
        $activity->points()->create(['sequence' => 0, 'lat' => 38.7, 'lng' => -9.1, 'recorded_at' => now()]);

        $response = $this->withHeaders($this->authHeader($user))->getJson("/api/v1/activities/{$activity->id}");

        $response->assertOk()->assertJsonCount(1, 'points');
    }

    public function test_show_rejects_another_users_activity(): void
    {
        $owner = User::factory()->create();
        $intruder = User::factory()->create();
        $activity = Activity::factory()->for($owner)->create();

        $this->withHeaders($this->authHeader($intruder))
            ->getJson("/api/v1/activities/{$activity->id}")
            ->assertStatus(403);
    }

    public function test_activities_require_authentication(): void
    {
        $this->getJson('/api/v1/activities')->assertStatus(401);
    }
}
