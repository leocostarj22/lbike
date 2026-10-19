<?php

namespace Tests\Feature\Api;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AuthTest extends TestCase
{
    use RefreshDatabase;

    public function test_login_returns_token_for_valid_credentials(): void
    {
        $user = User::factory()->create(['password' => bcrypt('password123')]);

        $response = $this->postJson('/api/v1/login', [
            'email' => $user->email,
            'password' => 'password123',
        ]);

        $response->assertOk()->assertJsonStructure(['user' => ['id', 'name', 'email'], 'token']);
    }

    public function test_login_rejects_invalid_credentials(): void
    {
        $response = $this->postJson('/api/v1/login', [
            'email' => 'nobody@example.com',
            'password' => 'wrong',
        ]);

        $response->assertStatus(401)->assertJson(['message' => 'Invalid credentials.']);
    }

    public function test_me_returns_authenticated_user(): void
    {
        $user = User::factory()->create();
        $token = $user->createToken('mobile')->plainTextToken;

        $response = $this->withHeader('Authorization', "Bearer {$token}")->getJson('/api/v1/me');

        $response->assertOk()->assertJsonPath('user.id', $user->id);
    }

    public function test_me_rejects_missing_token(): void
    {
        $this->getJson('/api/v1/me')->assertStatus(401);
    }

    public function test_logout_revokes_token(): void
    {
        $user = User::factory()->create();
        $token = $user->createToken('mobile')->plainTextToken;

        $this->withHeader('Authorization', "Bearer {$token}")->postJson('/api/v1/logout')
            ->assertStatus(204);

        // The sanctum guard caches its resolved user on the guard instance, which
        // this in-process test harness shares across requests within one test —
        // a real second HTTP request would not share it. Forget guards so this
        // second call re-resolves the (now revoked) token, as a real request would.
        $this->app['auth']->forgetGuards();

        $this->getJson('/api/v1/me', ['Authorization' => "Bearer {$token}"])->assertStatus(401);
    }
}
