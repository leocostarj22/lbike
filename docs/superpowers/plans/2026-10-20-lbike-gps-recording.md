# LBike GPS Activity Recording Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a logged-in user record a run/ride/walk with the browser's GPS,
save it to the backend when finished, and see it in a list of their own
past activities.

**Architecture:** New Laravel `Activity`/`ActivityPoint` models and an
`ActivityController` (store/index/show) behind Sanctum auth, mirroring the
existing `AuthController`. On the frontend, a small set of pure/testable
recording primitives (distance math, point filtering, local persistence,
Wake Lock) compose into one `useActivityRecorder` hook that drives the real
`RecordPage` screen; a `ActivitiesPage` lists what got saved.

**Tech Stack:** Laravel + Sanctum + Pest/PHPUnit-style feature tests
(backend, unchanged from Plan 1); React + TypeScript + Vitest +
@testing-library/react (frontend, unchanged from Plan 1); browser
Geolocation API and Wake Lock API (no new npm dependencies).

**Spec:** `docs/superpowers/specs/2026-10-19-lbike-design.md` — MVP
Objective 1, and the "Rastreio de localização" architecture section.

## Global Constraints

- All user-visible text in European Portuguese — per spec, unchanged from
  Plan 1. Activity type labels: `running` → "Corrida", `cycling` →
  "Pedalada", `walking` → "Caminhada".
- Units: kilometres (1 decimal place) for distance, `mm:ss` (or `h:mm:ss`
  past one hour) for duration — per spec's "Identidade visual" section.
- Activities are **private by default** (`visibility: 'private'`) — per
  spec's privacy section; nothing in this plan changes that default.
- GPS tracking "funciona com o ecrã ligado durante o registo... não é
  garantido com o ecrã bloqueado" — the Wake Lock mitigation from the
  spec's architecture section is in scope; background tracking with the
  screen off is explicitly not promised.
- No map rendering, no route-to-map comparison, no photos/video, no
  social/sharing in this plan — those are Objective 2 (route planning) and
  Objective 3 (social), separate plans. "Moving time" vs. elapsed time is
  not distinguished in this plan (the spec does not require it for this
  objective); `moving_seconds` is populated equal to `duration_seconds`
  for now, with the column already in place for a future refinement.
- Backend API base path is `/api/v1`, Bearer-token auth via Sanctum,
  unchanged from Plan 1 — reuse `auth:sanctum` middleware and the existing
  `request()`/`ApiError` client (`frontend/src/api/client.ts`).

## Review Focus

- **GPS permission denied**: the spec requires clear handling, not a stuck
  spinner or silent failure. Covered in Task 7 (hook) and Task 8 (screen).
- **Geolocation unsupported by the browser**: same requirement, different
  trigger (no API at all, vs. the user saying no). Covered in Task 7/8.
- **An accidental reload mid-recording must not lose the activity**: the
  spec explicitly asks to persist the in-progress session locally. Covered
  in Task 5 (storage) and Task 7 (hook restores on mount).
- **A GPS jump or signal-loss artifact must not silently inflate the
  recorded distance**: the spec asks for "basic filtering... without
  discarding valid sections or fabricating data." Covered in Task 4.
- **Finishing with too few GPS points to form a track** (e.g. Finish
  pressed before the first fix arrives): must not crash or send a doomed
  request that the backend 422s — the user should see why saving isn't
  possible. Covered in Task 8 (frontend guard) and Task 2 (backend
  validation as the last line of defense).

---

### Task 1: Backend — Activity and ActivityPoint models

**Files:**
- Create: `backend/database/migrations/2026_10_20_000001_create_activities_table.php`
- Create: `backend/database/migrations/2026_10_20_000002_create_activity_points_table.php`
- Create: `backend/app/Models/Activity.php`
- Create: `backend/app/Models/ActivityPoint.php`
- Modify: `backend/app/Models/User.php` (add `activities()` relation)
- Test: `backend/tests/Feature/ActivityModelTest.php`

**Interfaces:**
- Produces:
  - `Activity` (table `activities`): `id, user_id, type (string), title (string, nullable), description (text, nullable), started_at (datetime), distance_meters (float), duration_seconds (unsigned int), moving_seconds (unsigned int), elevation_gain_meters (float, nullable), visibility (string, default 'private'), timestamps`. Fillable: all of the above except `id`/timestamps. `belongsTo(User::class)`. `points()`: `hasMany(ActivityPoint::class)->orderBy('sequence')`.
  - `ActivityPoint` (table `activity_points`, no model timestamps): `id, activity_id, sequence (unsigned int), lat (double), lng (double), altitude (double, nullable), recorded_at (datetime)`. Fillable: all except `id`. `belongsTo(Activity::class)`.
  - `User::activities()`: `hasMany(Activity::class)`.

- [ ] **Step 1: Write the failing test**

```php
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && php artisan test --filter=ActivityModelTest`
Expected: FAIL — `Activity` class not found (migrations/models don't exist yet).

- [ ] **Step 3: Implement the migrations and models** per the Interfaces
block. `type` and `visibility` are plain `string` columns (no DB-level
enum) — validation of their allowed values happens in Task 2's
controller, matching how the spec leaves exact DB choices to the builder.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && php artisan test --filter=ActivityModelTest`
Expected: PASS (1/1).

- [ ] **Step 5: Commit**

```bash
git add backend/database/migrations backend/app/Models
git commit -m "feat(backend): add Activity and ActivityPoint models"
```

---

### Task 2: Backend — ActivityController (store, index, show) + authorization

**Files:**
- Create: `backend/app/Policies/ActivityPolicy.php`
- Create: `backend/app/Http/Controllers/Api/ActivityController.php`
- Modify: `backend/routes/api.php` (register the three routes inside the existing `auth:sanctum` group)
- Test: `backend/tests/Feature/Api/ActivityTest.php`

**Interfaces:**
- Consumes: `Activity`, `ActivityPoint`, `User::activities()` (Task 1).
- Produces (exact response shapes later frontend tasks parse):
  - `POST /api/v1/activities` — body `{type, started_at, distance_meters, duration_seconds, moving_seconds, elevation_gain_meters?, title?, description?, points: [{lat, lng, altitude?, recorded_at}, ...]}` (points: array, `min:2`) → 201 `{activity: {id, type, title, description, started_at, distance_meters, duration_seconds, moving_seconds, elevation_gain_meters, visibility, created_at}}`; 422 `{message, errors}` on validation failure (same shape as `AuthController::register`).
  - `GET /api/v1/activities` → 200 `{activities: [ {id, type, title, description, started_at, distance_meters, duration_seconds, moving_seconds, elevation_gain_meters, visibility, created_at}, ... ]}`, only the authenticated user's own, ordered by `started_at` descending. No pagination for this plan — one user's own activity list is small; add it when a later plan needs it.
  - `GET /api/v1/activities/{activity}` → 200 `{activity: {...same fields as above...}, points: [{lat, lng, altitude, recorded_at}, ...]}` ordered by `sequence`; 403 (via policy) if the activity belongs to another user; 404 if it doesn't exist.

- [ ] **Step 1: Write the failing tests**

```php
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
        return ['Authorization' => 'Bearer ' . $user->createToken('test')->plainTextToken];
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
```

This test references `Activity::factory()`, which does not exist yet —
create `backend/database/factories/ActivityFactory.php` with sensible
defaults (`type: 'cycling'`, `started_at: now()`, `distance_meters: 1000`,
`duration_seconds: 300`, `moving_seconds: 300`, `visibility: 'private'`)
as part of Step 3, so the failing run below fails on the controller/route,
not on a missing factory.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && php artisan test --filter=ActivityTest`
Expected: FAIL — route `/api/v1/activities` doesn't exist yet (404s where
the assertions expect 201/200/422/403).

- [ ] **Step 3: Implement `ActivityPolicy`, `ActivityController`, the
factory, and the routes**

`ActivityPolicy::view(User $user, Activity $activity): bool` returns
`$user->id === $activity->user_id` (Laravel auto-discovers this policy
for the `Activity` model by naming convention — no manual registration
needed in this Laravel version). `ActivityController::show` calls
`Gate::authorize('view', $activity)` before returning.

`store` validates per the Interfaces block (`type: required|in:running,cycling,walking`,
`points: required|array|min:2`, `points.*.lat`/`points.*.lng`: required
numeric, `points.*.recorded_at`: required date), creates the `Activity`
with `visibility: 'private'` and the authenticated user, then creates its
`ActivityPoint`s with `sequence` set to each point's array index.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && php artisan test --filter=ActivityTest`
Expected: PASS (6/6).

- [ ] **Step 5: Commit**

```bash
git add backend/app/Policies backend/app/Http/Controllers/Api/ActivityController.php backend/database/factories backend/routes/api.php backend/tests/Feature/Api/ActivityTest.php
git commit -m "feat(backend): add activity store/index/show endpoints"
```

---

### Task 3: Frontend — activities API client

**Files:**
- Create: `frontend/src/api/activities.ts`
- Test: `frontend/src/api/__tests__/activities.test.ts`

**Interfaces:**
- Consumes: `request`, `ApiError` from `./client` (Plan 1, Task 2).
- Produces:
  - `export type ActivityType = 'running' | 'cycling' | 'walking';`
  - `export interface ActivityPointInput { lat: number; lng: number; altitude?: number; recorded_at: string }`
  - `export interface Activity { id: number; type: ActivityType; title: string | null; description: string | null; started_at: string; distance_meters: number; duration_seconds: number; moving_seconds: number; elevation_gain_meters: number | null; visibility: string; created_at: string }`
  - `export async function createActivityRequest(token: string, payload: { type: ActivityType; started_at: string; distance_meters: number; duration_seconds: number; moving_seconds: number; title?: string; description?: string; points: ActivityPointInput[] }): Promise<{ activity: Activity }>` — POSTs `/activities` with the bearer header.
  - `export async function listActivitiesRequest(token: string): Promise<{ activities: Activity[] }>` — GETs `/activities` with the bearer header.

- [ ] **Step 1: Write the failing test**

```ts
// frontend/src/api/__tests__/activities.test.ts
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { createActivityRequest, listActivitiesRequest } from '../activities';

beforeEach(() => { vi.stubGlobal('fetch', vi.fn()); });

describe('createActivityRequest', () => {
  test('posts the activity payload with the bearer token', async () => {
    (fetch as any).mockResolvedValue({ ok: true, status: 201, json: async () => ({ activity: { id: 1 } }) });
    await createActivityRequest('tok', {
      type: 'cycling',
      started_at: '2026-10-20T10:00:00Z',
      distance_meters: 1000,
      duration_seconds: 300,
      moving_seconds: 300,
      points: [{ lat: 1, lng: 2, recorded_at: '2026-10-20T10:00:00Z' }],
    });
    const [url, options] = (fetch as any).mock.calls[0];
    expect(url).toContain('/activities');
    expect(options.headers.Authorization).toBe('Bearer tok');
    expect(JSON.parse(options.body).type).toBe('cycling');
  });
});

describe('listActivitiesRequest', () => {
  test('sends the bearer token', async () => {
    (fetch as any).mockResolvedValue({ ok: true, status: 200, json: async () => ({ activities: [] }) });
    await listActivitiesRequest('tok');
    const [, options] = (fetch as any).mock.calls[0];
    expect(options.headers.Authorization).toBe('Bearer tok');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/api/__tests__/activities.test.ts`
Expected: FAIL — `../activities` does not exist yet.

- [ ] **Step 3: Implement `activities.ts`** per the Interfaces block.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/api/__tests__/activities.test.ts`
Expected: PASS (2/2).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/api/activities.ts frontend/src/api/__tests__/activities.test.ts
git commit -m "feat(frontend): add activities API client"
```

---

### Task 4: Frontend — recording math, filtering, formatting, and type labels

**Files:**
- Create: `frontend/src/recording/geo.ts`
- Create: `frontend/src/recording/format.ts`
- Create: `frontend/src/recording/activityTypes.ts`
- Test: `frontend/src/recording/__tests__/geo.test.ts`, `frontend/src/recording/__tests__/format.test.ts`

**Interfaces:**
- Produces:
  - `export interface GeoPoint { lat: number; lng: number; altitude?: number; timestampMs: number }` (in `geo.ts`)
  - `export function haversineDistanceMeters(a: GeoPoint, b: GeoPoint): number`
  - `export const MAX_PLAUSIBLE_SPEED_MPS = 42;` (≈151 km/h — generous enough to never clip a real descent, catches GPS-jump artifacts)
  - `export function shouldAcceptPoint(previous: GeoPoint | null, next: GeoPoint): boolean` — `true` if `previous` is `null`; otherwise `false` if `next.timestampMs <= previous.timestampMs` (out-of-order/duplicate tick), `false` if the implied speed between them exceeds `MAX_PLAUSIBLE_SPEED_MPS`, otherwise `true`.
  - `export function totalDistanceMeters(points: GeoPoint[]): number` — sum of `haversineDistanceMeters` over consecutive pairs; `0` for fewer than 2 points.
  - `export function formatDistanceKm(meters: number): string` (in `format.ts`) — e.g. `1500` → `"1.5 km"`, one decimal place, always with the `km` suffix.
  - `export function formatDuration(seconds: number): string` — `"mm:ss"` under an hour (e.g. `75` → `"01:15"`), `"h:mm:ss"` at or past one hour (e.g. `3661` → `"1:01:01"`).
  - `export type ActivityType = 'running' | 'cycling' | 'walking';` (in `activityTypes.ts`; Tasks 7-9 import this one. Task 3's `activities.ts` independently declares the same literal union for its own payload typing — the two are structurally identical, so values pass between them with no cast needed; this is not worth a cross-module import for a three-string-literal type.)
  - `export const ACTIVITY_TYPE_LABELS: Record<ActivityType, string> = { running: 'Corrida', cycling: 'Pedalada', walking: 'Caminhada' };`

- [ ] **Step 1: Write the failing tests**

```ts
// frontend/src/recording/__tests__/geo.test.ts
import { describe, test, expect } from 'vitest';
import { haversineDistanceMeters, shouldAcceptPoint, totalDistanceMeters, MAX_PLAUSIBLE_SPEED_MPS } from '../geo';

describe('haversineDistanceMeters', () => {
  test('matches the known distance between two coordinates', () => {
    // Lisbon Rossio to Belém, ~6.5km apart
    const a = { lat: 38.7139, lng: -9.1394, timestampMs: 0 };
    const b = { lat: 38.6975, lng: -9.2041, timestampMs: 0 };
    const distance = haversineDistanceMeters(a, b);
    expect(distance).toBeGreaterThan(6000);
    expect(distance).toBeLessThan(7000);
  });
});

describe('shouldAcceptPoint', () => {
  const base = { lat: 38.71, lng: -9.13, timestampMs: 1000 };

  test('always accepts the first point', () => {
    expect(shouldAcceptPoint(null, base)).toBe(true);
  });

  test('rejects an out-of-order or duplicate timestamp', () => {
    expect(shouldAcceptPoint(base, { ...base, timestampMs: 1000 })).toBe(false);
    expect(shouldAcceptPoint(base, { ...base, timestampMs: 500 })).toBe(false);
  });

  test('rejects an implausible speed jump', () => {
    const farAway = { lat: 39.5, lng: -9.13, timestampMs: 1500 }; // ~88km in 0.5s
    expect(shouldAcceptPoint(base, farAway)).toBe(false);
  });

  test('accepts a normal sequential point', () => {
    const next = { lat: 38.7101, lng: -9.1301, timestampMs: 2000 };
    expect(shouldAcceptPoint(base, next)).toBe(true);
  });
});

describe('totalDistanceMeters', () => {
  test('sums consecutive segments', () => {
    const points = [
      { lat: 38.71, lng: -9.13, timestampMs: 0 },
      { lat: 38.7101, lng: -9.1301, timestampMs: 1000 },
      { lat: 38.7102, lng: -9.1302, timestampMs: 2000 },
    ];
    const total = totalDistanceMeters(points);
    const sumOfParts =
      haversineDistanceMeters(points[0], points[1]) + haversineDistanceMeters(points[1], points[2]);
    expect(total).toBeCloseTo(sumOfParts, 5);
  });

  test('is zero for fewer than two points', () => {
    expect(totalDistanceMeters([])).toBe(0);
    expect(totalDistanceMeters([{ lat: 0, lng: 0, timestampMs: 0 }])).toBe(0);
  });
});
```

```ts
// frontend/src/recording/__tests__/format.test.ts
import { describe, test, expect } from 'vitest';
import { formatDistanceKm, formatDuration } from '../format';

describe('formatDistanceKm', () => {
  test('formats meters as one-decimal kilometres', () => {
    expect(formatDistanceKm(1500)).toBe('1.5 km');
    expect(formatDistanceKm(300)).toBe('0.3 km');
  });
});

describe('formatDuration', () => {
  test('formats under an hour as mm:ss', () => {
    expect(formatDuration(75)).toBe('01:15');
  });

  test('formats an hour or more as h:mm:ss', () => {
    expect(formatDuration(3661)).toBe('1:01:01');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npx vitest run src/recording`
Expected: FAIL — `../geo` and `../format` don't exist yet.

- [ ] **Step 3: Implement `geo.ts`, `format.ts`, and `activityTypes.ts`**
per the Interfaces block.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npx vitest run src/recording`
Expected: PASS (8/8).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/recording
git commit -m "feat(frontend): add recording distance/filtering/formatting helpers"
```

---

### Task 5: Frontend — local persistence for an in-progress recording

**Files:**
- Create: `frontend/src/recording/recordingStorage.ts`
- Test: `frontend/src/recording/__tests__/recordingStorage.test.ts`

**Interfaces:**
- Consumes: `GeoPoint`, `ActivityType` (Task 4).
- Produces:
  - `export interface StoredRecording { activityType: ActivityType; startedAtMs: number; points: GeoPoint[]; elapsedSeconds: number }`
  - `export function saveRecording(data: StoredRecording): void` — writes JSON to `localStorage` under key `'lbike_recording'`.
  - `export function loadRecording(): StoredRecording | null` — returns `null` if nothing is stored, and `null` (clearing the bad entry) if the stored value isn't valid JSON.
  - `export function clearRecording(): void`

- [ ] **Step 1: Write the failing test**

```ts
// frontend/src/recording/__tests__/recordingStorage.test.ts
import { describe, test, expect, beforeEach } from 'vitest';
import { saveRecording, loadRecording, clearRecording } from '../recordingStorage';

beforeEach(() => localStorage.clear());

describe('recordingStorage', () => {
  test('returns null when nothing is stored', () => {
    expect(loadRecording()).toBeNull();
  });

  test('round-trips a saved recording', () => {
    const data = { activityType: 'cycling' as const, startedAtMs: 1000, points: [{ lat: 1, lng: 2, timestampMs: 1000 }], elapsedSeconds: 30 };
    saveRecording(data);
    expect(loadRecording()).toEqual(data);
  });

  test('clear removes the stored recording', () => {
    saveRecording({ activityType: 'cycling', startedAtMs: 1000, points: [], elapsedSeconds: 0 });
    clearRecording();
    expect(loadRecording()).toBeNull();
  });

  test('returns null and clears a corrupted entry instead of throwing', () => {
    localStorage.setItem('lbike_recording', 'not json{{{');
    expect(loadRecording()).toBeNull();
    expect(localStorage.getItem('lbike_recording')).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/recording/__tests__/recordingStorage.test.ts`
Expected: FAIL — `../recordingStorage` does not exist yet.

- [ ] **Step 3: Implement `recordingStorage.ts`** per the Interfaces
block. `loadRecording` wraps its `JSON.parse` in a try/catch; on failure,
calls `clearRecording()` then returns `null`.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/recording/__tests__/recordingStorage.test.ts`
Expected: PASS (4/4).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/recording/recordingStorage.ts frontend/src/recording/__tests__/recordingStorage.test.ts
git commit -m "feat(frontend): persist in-progress recordings across reloads"
```

---

### Task 6: Frontend — Wake Lock hook

**Files:**
- Create: `frontend/src/recording/useWakeLock.ts`
- Test: `frontend/src/recording/__tests__/useWakeLock.test.ts`

**Interfaces:**
- Produces: `export function useWakeLock(active: boolean): { supported: boolean }` — while `active` is `true` and `navigator.wakeLock` exists, holds a screen wake lock (requested on activation, released when `active` becomes `false` or the component unmounts); `supported` is `false` and the hook is a no-op when `navigator.wakeLock` doesn't exist.

- [ ] **Step 1: Write the failing test**

```ts
// frontend/src/recording/__tests__/useWakeLock.test.ts
import { renderHook } from '@testing-library/react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { useWakeLock } from '../useWakeLock';

describe('useWakeLock', () => {
  beforeEach(() => {
    // @ts-expect-error test-only global
    delete navigator.wakeLock;
  });

  test('reports unsupported and does nothing when the API is missing', () => {
    const { result } = renderHook(() => useWakeLock(true));
    expect(result.current.supported).toBe(false);
  });

  test('requests a lock on activation and releases it on deactivation', async () => {
    const release = vi.fn().mockResolvedValue(undefined);
    const request = vi.fn().mockResolvedValue({ release });
    // @ts-expect-error test-only global
    navigator.wakeLock = { request };

    const { result, rerender } = renderHook(({ active }) => useWakeLock(active), { initialProps: { active: false } });
    expect(result.current.supported).toBe(true);
    expect(request).not.toHaveBeenCalled();

    rerender({ active: true });
    await vi.waitFor(() => expect(request).toHaveBeenCalledWith('screen'));

    rerender({ active: false });
    await vi.waitFor(() => expect(release).toHaveBeenCalled());
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/recording/__tests__/useWakeLock.test.ts`
Expected: FAIL — `../useWakeLock` does not exist yet.

- [ ] **Step 3: Implement `useWakeLock.ts`** per the Interfaces block,
using a `useEffect` keyed on `active` that requests/releases the lock and
cleans up on unmount.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/recording/__tests__/useWakeLock.test.ts`
Expected: PASS (2/2).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/recording/useWakeLock.ts frontend/src/recording/__tests__/useWakeLock.test.ts
git commit -m "feat(frontend): add Wake Lock hook to keep the screen on while recording"
```

---

### Task 7: Frontend — useActivityRecorder hook

**Files:**
- Create: `frontend/src/recording/useActivityRecorder.ts`
- Test: `frontend/src/recording/__tests__/useActivityRecorder.test.ts`

**Interfaces:**
- Consumes: `GeoPoint`, `ActivityType`, `shouldAcceptPoint`,
  `totalDistanceMeters` (Task 4); `StoredRecording`, `saveRecording`,
  `loadRecording`, `clearRecording` (Task 5).
- Produces:
  - `export type RecorderStatus = 'idle' | 'recording' | 'paused' | 'finished';`
  - `export type PermissionState = 'unknown' | 'granted' | 'denied' | 'unsupported';`
  - `export interface RecordingSummary { activityType: ActivityType; startedAtMs: number; distanceMeters: number; durationSeconds: number; points: GeoPoint[] }`
  - `export function useActivityRecorder(watchPositionFn?: typeof navigator.geolocation.watchPosition): { status: RecorderStatus; permissionState: PermissionState; distanceMeters: number; elapsedSeconds: number; start(activityType: ActivityType): void; pause(): void; resume(): void; finish(): RecordingSummary | null; discard(): void }`
  - The optional `watchPositionFn` parameter (defaulting to
    `navigator.geolocation?.watchPosition`) is how tests substitute a fake
    GPS source — production code never passes it explicitly.

- [ ] **Step 1: Write the failing tests**

```ts
// frontend/src/recording/__tests__/useActivityRecorder.test.ts
import { renderHook, act } from '@testing-library/react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { useActivityRecorder } from '../useActivityRecorder';
import { clearRecording, saveRecording } from '../recordingStorage';

function fakeWatchPosition(positions: GeolocationPosition[]) {
  return vi.fn((success: PositionCallback) => {
    positions.forEach((p) => success(p));
    return 1;
  });
}

function position(lat: number, lng: number, timestamp: number): GeolocationPosition {
  return { coords: { latitude: lat, longitude: lng, altitude: null } as any, timestamp } as GeolocationPosition;
}

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers();
});

describe('useActivityRecorder', () => {
  test('is unsupported when there is no watchPosition function', () => {
    const { result } = renderHook(() => useActivityRecorder(undefined));
    expect(result.current.permissionState).toBe('unsupported');
  });

  test('start() begins recording and accumulates distance from fed points', () => {
    const watch = fakeWatchPosition([position(38.71, -9.13, 1000), position(38.7101, -9.1301, 2000)]);
    const { result } = renderHook(() => useActivityRecorder(watch as any));

    act(() => result.current.start('cycling'));

    expect(result.current.status).toBe('recording');
    expect(result.current.permissionState).toBe('granted');
    expect(result.current.distanceMeters).toBeGreaterThan(0);
  });

  test('a PERMISSION_DENIED error sets permissionState and returns to idle', () => {
    const watch = vi.fn((_success: PositionCallback, error?: PositionErrorCallback) => {
      error?.({ code: 1, PERMISSION_DENIED: 1 } as GeolocationPositionError);
      return 1;
    });
    const { result } = renderHook(() => useActivityRecorder(watch as any));

    act(() => result.current.start('cycling'));

    expect(result.current.permissionState).toBe('denied');
    expect(result.current.status).toBe('idle');
  });

  test('pause() then resume() continues accumulating elapsed time', () => {
    const watch = fakeWatchPosition([position(38.71, -9.13, 1000)]);
    const { result } = renderHook(() => useActivityRecorder(watch as any));

    act(() => result.current.start('cycling'));
    act(() => { vi.advanceTimersByTime(5000); });
    act(() => result.current.pause());
    const pausedAt = result.current.elapsedSeconds;
    act(() => { vi.advanceTimersByTime(5000); }); // must not accumulate while paused
    expect(result.current.elapsedSeconds).toBe(pausedAt);

    act(() => result.current.resume());
    act(() => { vi.advanceTimersByTime(2000); });
    expect(result.current.elapsedSeconds).toBeGreaterThan(pausedAt);
  });

  test('finish() returns a summary and stops the watch', () => {
    const watch = fakeWatchPosition([position(38.71, -9.13, 1000), position(38.7101, -9.1301, 2000)]);
    const { result } = renderHook(() => useActivityRecorder(watch as any));

    act(() => result.current.start('cycling'));
    let summary: ReturnType<typeof result.current.finish> = null;
    act(() => { summary = result.current.finish(); });

    expect(result.current.status).toBe('finished');
    expect(summary?.points.length).toBe(2);
    expect(summary?.activityType).toBe('cycling');
  });

  test('discard() clears persisted storage and resets to idle', () => {
    saveRecording({ activityType: 'cycling', startedAtMs: 1000, points: [], elapsedSeconds: 10 });
    const { result } = renderHook(() => useActivityRecorder(fakeWatchPosition([]) as any));

    act(() => result.current.discard());

    expect(result.current.status).toBe('idle');
    expect(localStorage.getItem('lbike_recording')).toBeNull();
  });

  test('restores a previously-paused recording on mount', () => {
    saveRecording({ activityType: 'running', startedAtMs: 1000, points: [{ lat: 1, lng: 2, timestampMs: 1000 }], elapsedSeconds: 42 });
    const { result } = renderHook(() => useActivityRecorder(fakeWatchPosition([]) as any));

    expect(result.current.status).toBe('paused');
    expect(result.current.elapsedSeconds).toBe(42);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npx vitest run src/recording/__tests__/useActivityRecorder.test.ts`
Expected: FAIL — `../useActivityRecorder` does not exist yet.

- [ ] **Step 3: Implement `useActivityRecorder.ts`**

State machine: `idle → recording → (paused ⇄ recording) → finished`, with
`discard()` resetting to `idle` from any state. `start(activityType)`:
if no `watchPositionFn` is available, set `permissionState: 'unsupported'`
and stay `idle`; otherwise call it with success/error callbacks, set
`status: 'recording'`. On each success callback, build a `GeoPoint` from
`position.coords`/`position.timestamp`, run it through `shouldAcceptPoint`
against the last accepted point before appending, recompute
`distanceMeters` via `totalDistanceMeters`, and set `permissionState:
'granted'`. On the error callback, if `error.code === 1` (matches
`PERMISSION_DENIED`), set `permissionState: 'denied'` and `status:
'idle'`. Elapsed time ticks via a `setInterval` running only while
`status === 'recording'`, cleared on pause/finish/discard/unmount.

Stopping the live GPS watch — call `navigator.geolocation?.clearWatch?.(watchId)`
(optional chaining both ways: the test doubles above pass a bare function
with no matching `clearWatch`, and jsdom has no `navigator.geolocation` at
all, so this is a no-op under test and a real cleanup call in a browser) —
happens on `pause()`, `finish()`, `discard()`, and unmount, not only on
`finish()`: a paused recording must stop consuming GPS/battery, not just
stop updating the display. `resume()` calls `watchPositionFn` again (same
success/error wiring as `start()`) to get a fresh `watchId`. `pause()` also
persists the current state via `saveRecording()`, so a reload while paused
restores correctly (see the mount-restore behaviour below).

`finish()` flips `status` to `'finished'`, builds and returns the
`RecordingSummary`, and leaves the recording in `localStorage` for Task 8
to clear only after a successful save — this is deliberate: a user who
reloads mid-summary-entry (writing a title) before saving should not lose
the finished recording either. `discard()` stops the watch and interval
from any status, calls `clearRecording()`, and resets to `idle`.

On mount, call `loadRecording()`; if it returns a `StoredRecording`,
restore `status: 'paused'` with its `points`/`elapsedSeconds`/
`activityType` (the user explicitly resumes from there, rather than GPS
tracking silently restarting on app open). Persist to `localStorage` via
`saveRecording()` after every accepted point and on every `pause()`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npx vitest run src/recording/__tests__/useActivityRecorder.test.ts`
Expected: PASS (7/7).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/recording/useActivityRecorder.ts frontend/src/recording/__tests__/useActivityRecorder.test.ts
git commit -m "feat(frontend): add useActivityRecorder GPS recording hook"
```

---

### Task 8: Frontend — RecordPage (real recording screen)

**Files:**
- Modify: `frontend/src/auth/AuthContext.tsx` (expose the stored bearer token)
- Modify: `frontend/src/auth/__tests__/AuthContext.test.tsx` (cover the new field)
- Modify: `frontend/src/pages/RecordPage.tsx` (replace the Plan 1 placeholder)
- Test: `frontend/src/pages/__tests__/RecordPage.test.tsx`

**Interfaces:**
- Consumes: `useActivityRecorder` (Task 7), `useWakeLock` (Task 6),
  `ACTIVITY_TYPE_LABELS`, `ActivityType` (Task 4), `createActivityRequest`
  (Task 3), `useAuth()` (Plan 1 Task 3, extended here).
- Produces: `AuthContextValue` gains `token: string | null` (the same
  value held in `localStorage` under `lbike_token`, exposed read-only so
  screens that call authenticated endpoints directly — like this one —
  don't each re-read `localStorage` themselves). `RecordPage` has no
  exported interface other tasks depend on.

- [ ] **Step 1: Write the failing tests**

In `frontend/src/auth/__tests__/AuthContext.test.tsx`, make two edits:

1. Add `token` to `Probe`'s destructured hook result and render it:

```tsx
function Probe() {
  const { user, isLoading, login, logout, token } = useAuth();
  if (isLoading) return <div>A carregar...</div>;
  return (
    <div>
      <div>{user ? `Ola, ${user.name}` : 'Sem sessao'}</div>
      <div>{token ?? 'sem token'}</div>
      <button onClick={() => login('l@e.com', 'secret')}>Entrar</button>
      <button onClick={() => logout()}>Sair</button>
    </div>
  );
}
```

2. In the `'login stores the token and user; logout clears both'` test,
add one assertion right after the existing
`expect(localStorage.getItem('lbike_token')).toBe('abc');` line:

```tsx
    expect(screen.getByText('abc')).toBeInTheDocument();
```

and one more right after the test's final
`expect(localStorage.getItem('lbike_token')).toBeNull();` line:

```tsx
    expect(screen.getByText('sem token')).toBeInTheDocument();
```

```tsx
// frontend/src/pages/__tests__/RecordPage.test.tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, test, expect, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import RecordPage from '../RecordPage';
import * as useAuthModule from '../../auth/AuthContext';
import * as recorderModule from '../../recording/useActivityRecorder';
import * as activitiesApi from '../../api/activities';

vi.mock('../../auth/AuthContext');
vi.mock('../../recording/useActivityRecorder');
vi.mock('../../api/activities');

function mockRecorder(overrides: Partial<ReturnType<typeof recorderModule.useActivityRecorder>>) {
  vi.mocked(recorderModule.useActivityRecorder).mockReturnValue({
    status: 'idle', permissionState: 'unknown', distanceMeters: 0, elapsedSeconds: 0,
    start: vi.fn(), pause: vi.fn(), resume: vi.fn(), finish: vi.fn(), discard: vi.fn(),
    ...overrides,
  });
}

beforeEach(() => {
  vi.mocked(useAuthModule.useAuth).mockReturnValue({
    user: { id: 1, name: 'Lucas', email: 'l@e.com' }, isLoading: false, token: 'tok',
    login: vi.fn(), register: vi.fn(), logout: vi.fn(),
  });
});

describe('RecordPage', () => {
  test('shows the activity type picker and Start when idle', () => {
    mockRecorder({ status: 'idle' });
    render(<MemoryRouter><RecordPage /></MemoryRouter>);
    expect(screen.getByText('Pedalada')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Iniciar' })).toBeInTheDocument();
  });

  test('shows live distance and elapsed time while recording', () => {
    mockRecorder({ status: 'recording', distanceMeters: 1500, elapsedSeconds: 75 });
    render(<MemoryRouter><RecordPage /></MemoryRouter>);
    expect(screen.getByText('1.5 km')).toBeInTheDocument();
    expect(screen.getByText('01:15')).toBeInTheDocument();
  });

  test('shows a clear message when permission is denied', () => {
    mockRecorder({ status: 'idle', permissionState: 'denied' });
    render(<MemoryRouter><RecordPage /></MemoryRouter>);
    expect(screen.getByText(/Permissão de localização negada/)).toBeInTheDocument();
  });

  test('finishing with too few points disables saving instead of calling the API', async () => {
    const finish = vi.fn().mockReturnValue({ activityType: 'cycling', startedAtMs: 1000, distanceMeters: 0, durationSeconds: 3, points: [{ lat: 1, lng: 2, timestampMs: 1000 }] });
    mockRecorder({ status: 'recording', finish });
    const user = userEvent.setup();
    render(<MemoryRouter><RecordPage /></MemoryRouter>);

    await user.click(screen.getByRole('button', { name: 'Terminar' }));

    expect(screen.getByText('Registo demasiado curto para guardar.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Guardar' })).not.toBeInTheDocument();
  });

  test('saving the summary calls the API with the recorded data and navigates to /activities', async () => {
    const finish = vi.fn().mockReturnValue({
      activityType: 'cycling', startedAtMs: 1000, distanceMeters: 1500, durationSeconds: 300,
      points: [{ lat: 1, lng: 2, timestampMs: 1000 }, { lat: 1.001, lng: 2.001, timestampMs: 2000 }],
    });
    mockRecorder({ status: 'recording', finish });
    vi.mocked(activitiesApi.createActivityRequest).mockResolvedValue({ activity: { id: 1 } as any });
    const user = userEvent.setup();
    render(<MemoryRouter><RecordPage /></MemoryRouter>);

    await user.click(screen.getByRole('button', { name: 'Terminar' }));
    await user.type(screen.getByLabelText('Título (opcional)'), 'Volta no parque');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    await waitFor(() => expect(activitiesApi.createActivityRequest).toHaveBeenCalledWith('tok', expect.objectContaining({
      type: 'cycling', distance_meters: 1500, duration_seconds: 300, title: 'Volta no parque',
    })));
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npx vitest run src/auth src/pages/__tests__/RecordPage.test.tsx`
Expected: FAIL — `token` isn't part of `AuthContextValue` yet, and
`RecordPage` still renders the Plan 1 placeholder.

- [ ] **Step 3: Implement the `AuthContext` change and the real
`RecordPage`**

`AuthContext.tsx`: add a `token` state mirrored alongside `user` (set
together in `storeSession`, mount restore, and `logout`), and include it
in the provided `AuthContextValue`.

`RecordPage.tsx`: idle state renders three buttons (Corrida/Pedalada/
Caminhada, from `ACTIVITY_TYPE_LABELS`) that call `start(type)`, plus an
"Iniciar" button; while `permissionState === 'denied'` show "Permissão de
localização negada. Ativa a localização para registar." (and while
`'unsupported'`, an equivalent message for missing GPS support) instead of
the picker. While `recording`/`paused`, show `formatDistanceKm`/
`formatDuration` of the live values and Pausar/Retomar, Terminar,
Descartar buttons. `useWakeLock(status === 'recording')` is called
unconditionally at the top of the component (Rules of Hooks). On
"Terminar", call `finish()`; if the summary has fewer than 2 points, show
"Registo demasiado curto para guardar." instead of a save form; otherwise
show the summary (distance, duration, optional "Título (opcional)" /
"Descrição (opcional)" inputs) with "Guardar" calling
`createActivityRequest(token, { type: summary.activityType,
started_at: new Date(summary.startedAtMs).toISOString(),
distance_meters: summary.distanceMeters, duration_seconds:
summary.durationSeconds, moving_seconds: summary.durationSeconds, title,
description, points: summary.points.map(p => ({ lat: p.lat, lng: p.lng,
altitude: p.altitude, recorded_at: new Date(p.timestampMs).toISOString() })) })`
then navigating to `/activities`, and "Descartar" calling `discard()`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npx vitest run src/auth src/pages/__tests__/RecordPage.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/auth/AuthContext.tsx frontend/src/auth/__tests__/AuthContext.test.tsx frontend/src/pages/RecordPage.tsx frontend/src/pages/__tests__/RecordPage.test.tsx
git commit -m "feat(frontend): build the real GPS recording screen"
```

---

### Task 9: Frontend — ActivitiesPage (list saved activities)

**Files:**
- Modify: `frontend/src/pages/ActivitiesPage.tsx` (replace the Plan 1 placeholder)
- Test: `frontend/src/pages/__tests__/ActivitiesPage.test.tsx`

**Interfaces:**
- Consumes: `listActivitiesRequest`, `Activity` (Task 3); `useAuth()`
  (Task 8's `token`); `ACTIVITY_TYPE_LABELS`, `formatDistanceKm`,
  `formatDuration` (Task 4).
- Produces: nothing further tasks depend on.

- [ ] **Step 1: Write the failing test**

```tsx
// frontend/src/pages/__tests__/ActivitiesPage.test.tsx
import { render, screen, waitFor } from '@testing-library/react';
import { describe, test, expect, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import ActivitiesPage from '../ActivitiesPage';
import * as useAuthModule from '../../auth/AuthContext';
import * as activitiesApi from '../../api/activities';

vi.mock('../../auth/AuthContext');
vi.mock('../../api/activities');

beforeEach(() => {
  vi.mocked(useAuthModule.useAuth).mockReturnValue({
    user: { id: 1, name: 'Lucas', email: 'l@e.com' }, isLoading: false, token: 'tok',
    login: vi.fn(), register: vi.fn(), logout: vi.fn(),
  });
});

describe('ActivitiesPage', () => {
  test('lists the saved activities', async () => {
    vi.mocked(activitiesApi.listActivitiesRequest).mockResolvedValue({
      activities: [
        { id: 1, type: 'cycling', title: 'Volta no parque', description: null, started_at: '2026-10-20T10:00:00Z', distance_meters: 1500, duration_seconds: 300, moving_seconds: 300, elevation_gain_meters: null, visibility: 'private', created_at: '2026-10-20T10:05:00Z' },
      ],
    });
    render(<MemoryRouter><ActivitiesPage /></MemoryRouter>);

    await waitFor(() => expect(screen.getByText('Volta no parque')).toBeInTheDocument());
    expect(screen.getByText('Pedalada')).toBeInTheDocument();
    expect(screen.getByText('1.5 km')).toBeInTheDocument();
    expect(screen.getByText('05:00')).toBeInTheDocument();
  });

  test('shows an empty state for a new account', async () => {
    vi.mocked(activitiesApi.listActivitiesRequest).mockResolvedValue({ activities: [] });
    render(<MemoryRouter><ActivitiesPage /></MemoryRouter>);

    await waitFor(() => expect(screen.getByText('Ainda não tens atividades registadas.')).toBeInTheDocument());
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/pages/__tests__/ActivitiesPage.test.tsx`
Expected: FAIL — `ActivitiesPage` still renders the Plan 1 placeholder
text, not a fetched list.

- [ ] **Step 3: Implement `ActivitiesPage.tsx`**

On mount, call `listActivitiesRequest(token)`; render each activity as
`ACTIVITY_TYPE_LABELS[type]`, `title` (or "Sem título" when `null`),
`formatDistanceKm(distance_meters)`, `formatDuration(duration_seconds)`.
When the resolved list is empty, render "Ainda não tens atividades
registadas." instead of an empty list.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/pages/__tests__/ActivitiesPage.test.tsx`
Expected: PASS (2/2).

- [ ] **Step 5: Run the whole frontend suite and backend suite once more, then commit**

Run: `cd frontend && npx vitest run` — Expected: PASS (all tests, Plan 1's plus this plan's).
Run: `cd backend && php artisan test` — Expected: PASS (all tests, Plan 1's plus this plan's).

```bash
git add frontend/src/pages/ActivitiesPage.tsx frontend/src/pages/__tests__/ActivitiesPage.test.tsx
git commit -m "feat(frontend): list the user's saved activities"
```
