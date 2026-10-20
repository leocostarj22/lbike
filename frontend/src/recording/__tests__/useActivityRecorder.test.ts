import { renderHook, act } from '@testing-library/react';
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { useActivityRecorder } from '../useActivityRecorder';
import { saveRecording, loadRecording } from '../recordingStorage';

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

afterEach(() => {
  // @ts-expect-error test-only cleanup
  delete navigator.geolocation;
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

  test('calls watchPosition bound to navigator.geolocation when none is injected (no "Illegal invocation")', () => {
    const calls: string[] = [];
    const fakeGeolocation = {
      watchPosition(success: PositionCallback) {
        if (this !== fakeGeolocation) {
          throw new TypeError('Illegal invocation');
        }
        calls.push('called');
        success(position(38.71, -9.13, 1000));
        return 1;
      },
      clearWatch: vi.fn(),
    };
    Object.defineProperty(navigator, 'geolocation', { value: fakeGeolocation, configurable: true });

    const { result } = renderHook(() => useActivityRecorder(undefined));

    expect(() => act(() => result.current.start('cycling'))).not.toThrow();
    expect(calls).toEqual(['called']);
    expect(result.current.permissionState).toBe('granted');
  });

  test('requests high-accuracy fixes and no cached positions', () => {
    const watch = fakeWatchPosition([position(38.71, -9.13, 1000)]);
    const { result } = renderHook(() => useActivityRecorder(watch as any));

    act(() => result.current.start('cycling'));

    expect(watch).toHaveBeenCalledWith(
      expect.any(Function),
      expect.any(Function),
      expect.objectContaining({ enableHighAccuracy: true, maximumAge: 0 })
    );
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

  test('discards a GPS fix with an accuracy radius above the threshold', () => {
    const watch = vi.fn((success: PositionCallback) => {
      success({
        coords: { latitude: 38.71, longitude: -9.13, altitude: null, accuracy: 10 } as any,
        timestamp: 1000,
      } as GeolocationPosition);
      success({
        coords: { latitude: 38.7110, longitude: -9.1310, altitude: null, accuracy: 500 } as any,
        timestamp: 2000,
      } as GeolocationPosition);
      return 1;
    });
    const { result } = renderHook(() => useActivityRecorder(watch as any));

    act(() => result.current.start('cycling'));

    // Only the first (accurate) fix was accepted; the imprecise second fix
    // — which would otherwise add ~110m of fake distance — was discarded.
    expect(result.current.distanceMeters).toBe(0);
    expect(result.current.permissionState).toBe('granted');
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

  test('pause() computes elapsed time from the wall clock even if interval ticks were missed', () => {
    const watch = fakeWatchPosition([]);
    const { result } = renderHook(() => useActivityRecorder(watch as any));

    act(() => result.current.start('cycling'));
    act(() => { vi.setSystemTime(Date.now() + 65000); }); // simulate a backgrounded tab: no ticks fired
    act(() => result.current.pause());

    expect(result.current.elapsedSeconds).toBeGreaterThanOrEqual(65);
  });

  test('does not count the gap between pause and resume as travelled distance', () => {
    let callCount = 0;
    const watch = vi.fn((success: PositionCallback) => {
      callCount += 1;
      if (callCount === 1) {
        success(position(38.71, -9.13, 1000));
      } else {
        success(position(38.719, -9.13, 301000)); // ~1km away, long after the first fix
      }
      return callCount;
    });
    const { result } = renderHook(() => useActivityRecorder(watch as any));

    act(() => result.current.start('cycling'));
    act(() => result.current.pause());
    act(() => result.current.resume());

    expect(result.current.distanceMeters).toBe(0);
  });

  test('pause() persists the same elapsed time it displays, not a doubled-up value', () => {
    const watch = fakeWatchPosition([]);
    const { result } = renderHook(() => useActivityRecorder(watch as any));

    act(() => result.current.start('cycling'));
    act(() => { vi.advanceTimersByTime(5000); });
    act(() => result.current.pause());

    const stored = loadRecording();
    expect(stored?.elapsedSeconds).toBe(result.current.elapsedSeconds);
  });

  test('persists to storage after each accepted point while actively recording, not only on pause', () => {
    const watch = fakeWatchPosition([position(38.71, -9.13, 1000)]);
    const { result } = renderHook(() => useActivityRecorder(watch as any));

    act(() => result.current.start('cycling'));

    const stored = loadRecording();
    expect(stored).not.toBeNull();
    expect(stored?.points.length).toBe(1);
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
    saveRecording({ activityType: 'cycling', startedAtMs: 1000, points: [], elapsedSeconds: 10, distanceMeters: 0 });
    const { result } = renderHook(() => useActivityRecorder(fakeWatchPosition([]) as any));

    act(() => result.current.discard());

    expect(result.current.status).toBe('idle');
    expect(localStorage.getItem('lbike_recording')).toBeNull();
  });

  test('restores a previously-paused recording on mount', () => {
    saveRecording({ activityType: 'running', startedAtMs: 1000, points: [{ lat: 1, lng: 2, timestampMs: 1000 }], elapsedSeconds: 42, distanceMeters: 17 });
    const { result } = renderHook(() => useActivityRecorder(fakeWatchPosition([]) as any));

    expect(result.current.status).toBe('paused');
    expect(result.current.elapsedSeconds).toBe(42);
    expect(result.current.distanceMeters).toBe(17);
  });
});
