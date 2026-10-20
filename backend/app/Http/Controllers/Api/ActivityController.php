<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Activity;
use App\Models\ActivityPoint;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Validator;

class ActivityController extends Controller
{
    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'type' => ['required', 'in:running,cycling,walking'],
            'title' => ['nullable', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'started_at' => ['required', 'date'],
            'distance_meters' => ['required', 'numeric', 'min:0'],
            'duration_seconds' => ['required', 'integer', 'min:0'],
            'moving_seconds' => ['required', 'integer', 'min:0'],
            'elevation_gain_meters' => ['nullable', 'numeric', 'min:0'],
            'points' => ['required', 'array', 'min:2', 'max:20000'],
            'points.*.lat' => ['required', 'numeric', 'between:-90,90'],
            'points.*.lng' => ['required', 'numeric', 'between:-180,180'],
            'points.*.altitude' => ['nullable', 'numeric'],
            'points.*.recorded_at' => ['required', 'date'],
        ]);

        if ($validator->fails()) {
            return response()->json(['message' => $validator->errors()->first(), 'errors' => $validator->errors()], 422);
        }

        $data = $validator->validated();

        $activity = DB::transaction(function () use ($request, $data) {
            $activity = $request->user()->activities()->create([
                'type' => $data['type'],
                'title' => $data['title'] ?? null,
                'description' => $data['description'] ?? null,
                'started_at' => $data['started_at'],
                'distance_meters' => $data['distance_meters'],
                'duration_seconds' => $data['duration_seconds'],
                'moving_seconds' => $data['moving_seconds'],
                'elevation_gain_meters' => $data['elevation_gain_meters'] ?? null,
                'visibility' => 'private',
            ]);

            $rows = collect($data['points'])->map(fn (array $point, int $sequence) => [
                'activity_id' => $activity->id,
                'sequence' => $sequence,
                'lat' => $point['lat'],
                'lng' => $point['lng'],
                'altitude' => $point['altitude'] ?? null,
                'recorded_at' => Carbon::parse($point['recorded_at'])->toDateTimeString(),
            ])->all();

            foreach (array_chunk($rows, 500) as $chunk) {
                ActivityPoint::insert($chunk);
            }

            return $activity;
        });

        return response()->json(['activity' => $this->serializeActivity($activity)], 201);
    }

    public function index(Request $request)
    {
        $activities = $request->user()->activities()->orderByDesc('started_at')->get();

        return response()->json([
            'activities' => $activities->map(fn (Activity $activity) => $this->serializeActivity($activity)),
        ]);
    }

    public function show(Request $request, Activity $activity)
    {
        Gate::authorize('view', $activity);

        return response()->json([
            'activity' => $this->serializeActivity($activity),
            'points' => $activity->points->map(fn ($point) => [
                'lat' => $point->lat,
                'lng' => $point->lng,
                'altitude' => $point->altitude,
                'recorded_at' => $point->recorded_at,
            ]),
        ]);
    }

    private function serializeActivity(Activity $activity): array
    {
        return [
            'id' => $activity->id,
            'type' => $activity->type,
            'title' => $activity->title,
            'description' => $activity->description,
            'started_at' => $activity->started_at,
            'distance_meters' => $activity->distance_meters,
            'duration_seconds' => $activity->duration_seconds,
            'moving_seconds' => $activity->moving_seconds,
            'elevation_gain_meters' => $activity->elevation_gain_meters,
            'visibility' => $activity->visibility,
            'created_at' => $activity->created_at,
        ];
    }
}
