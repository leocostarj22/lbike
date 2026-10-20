import { renderHook, act } from '@testing-library/react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { useActivityRecorder } from '../useActivityRecorder';
import { saveRecording } from '../recordingStorage';

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
