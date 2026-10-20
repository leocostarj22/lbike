import { useEffect, useRef, useState } from 'react';
import { type GeoPoint, shouldAcceptPoint, haversineDistanceMeters, MAX_ACCURACY_METERS } from './geo';
import type { ActivityType } from './activityTypes';
import { type StoredRecording, saveRecording, loadRecording, clearRecording } from './recordingStorage';

export type RecorderStatus = 'idle' | 'recording' | 'paused' | 'finished';
export type PermissionState = 'unknown' | 'granted' | 'denied' | 'unsupported';

export interface RecordingSummary {
  activityType: ActivityType;
  startedAtMs: number;
  distanceMeters: number;
  durationSeconds: number;
  points: GeoPoint[];
}

// `navigator.geolocation` is typed as always-present in lib.dom.d.ts, so an
// optional-chaining check on it is a TypeScript no-op (and a type error).
// Older/unsupported browsers can still lack it at runtime, so this checks
// for real via `in`, and binds `watchPosition` to its receiver — calling it
// unbound (e.g. via a destructured reference) throws "Illegal invocation"
// in every major browser.
function resolveWatchPosition(): typeof navigator.geolocation.watchPosition | undefined {
  if (typeof navigator === 'undefined' || !('geolocation' in navigator) || !navigator.geolocation) {
    return undefined;
  }
  return navigator.geolocation.watchPosition.bind(navigator.geolocation);
}

function resolveClearWatch(): typeof navigator.geolocation.clearWatch | undefined {
  if (typeof navigator === 'undefined' || !('geolocation' in navigator) || !navigator.geolocation) {
    return undefined;
  }
  return navigator.geolocation.clearWatch.bind(navigator.geolocation);
}

export function useActivityRecorder(watchPositionFn?: typeof navigator.geolocation.watchPosition) {
  const [status, setStatus] = useState<RecorderStatus>('idle');
  const [permissionState, setPermissionState] = useState<PermissionState>(() =>
    watchPositionFn ?? resolveWatchPosition() ? 'unknown' : 'unsupported'
  );
  const [distanceMeters, setDistanceMeters] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const activityTypeRef = useRef<ActivityType>('cycling');
  const startedAtMsRef = useRef(0);
  const pointsRef = useRef<GeoPoint[]>([]);
  // The last point distance is measured FROM. Reset to null on resume so
  // the gap between pause and resume is never counted as travelled.
  const lastAcceptedPointRef = useRef<GeoPoint | null>(null);
  const distanceMetersRef = useRef(0);
  // Elapsed time is derived from wall-clock time, not counted ticks: a
  // backgrounded/throttled tab fires setInterval far less often than every
  // second, which would otherwise make the recorded duration run short.
  const baseElapsedSecondsRef = useRef(0);
  const segmentStartMsRef = useRef(0);
  const watchIdRef = useRef<number | null>(null);
  const intervalIdRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const stored = loadRecording();
    if (stored) {
      activityTypeRef.current = stored.activityType;
      startedAtMsRef.current = stored.startedAtMs;
      pointsRef.current = stored.points;
      lastAcceptedPointRef.current = stored.points[stored.points.length - 1] ?? null;
      distanceMetersRef.current = stored.distanceMeters;
      baseElapsedSecondsRef.current = stored.elapsedSeconds;
      setDistanceMeters(stored.distanceMeters);
      setElapsedSeconds(stored.elapsedSeconds);
      setStatus('paused');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function stopWatch() {
    if (watchIdRef.current !== null) {
      resolveClearWatch()?.(watchIdRef.current);
      watchIdRef.current = null;
    }
  }

  function stopInterval() {
    if (intervalIdRef.current !== null) {
      clearInterval(intervalIdRef.current);
      intervalIdRef.current = null;
    }
  }

  function currentElapsedSeconds(): number {
    return Math.floor(baseElapsedSecondsRef.current + (Date.now() - segmentStartMsRef.current) / 1000);
  }

  function startInterval() {
    stopInterval();
    intervalIdRef.current = setInterval(() => {
      setElapsedSeconds(currentElapsedSeconds());
    }, 1000);
  }

  function persist(elapsedSecondsOverride?: number) {
    saveRecording({
      activityType: activityTypeRef.current,
      startedAtMs: startedAtMsRef.current,
      points: pointsRef.current,
      elapsedSeconds: elapsedSecondsOverride ?? currentElapsedSeconds(),
      distanceMeters: distanceMetersRef.current,
    } satisfies StoredRecording);
  }

  function beginWatch() {
    const watch = watchPositionFn ?? resolveWatchPosition();
    if (!watch) {
      setPermissionState('unsupported');
      setStatus('idle');
      return;
    }

    watchIdRef.current = watch(
      (position) => {
        const accuracy = position.coords.accuracy;
        if (typeof accuracy === 'number' && accuracy > MAX_ACCURACY_METERS) {
          setPermissionState('granted');
          return;
        }

        const point: GeoPoint = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          altitude: position.coords.altitude ?? undefined,
          timestampMs: position.timestamp,
        };

        if (shouldAcceptPoint(lastAcceptedPointRef.current, point)) {
          if (lastAcceptedPointRef.current !== null) {
            distanceMetersRef.current += haversineDistanceMeters(lastAcceptedPointRef.current, point);
          }
          lastAcceptedPointRef.current = point;
          pointsRef.current = [...pointsRef.current, point];
          setDistanceMeters(distanceMetersRef.current);
          persist();
        }

        setPermissionState('granted');
      },
      (error) => {
        if (error.code === 1) {
          setPermissionState('denied');
          stopWatch();
          stopInterval();
          setStatus('idle');
        }
        // POSITION_UNAVAILABLE / TIMEOUT: the browser keeps retrying the
        // watch on its own; nothing to do here but wait for the next fix.
      },
      { enableHighAccuracy: true, maximumAge: 0 }
    );
  }

  function start(activityType: ActivityType) {
    activityTypeRef.current = activityType;
    startedAtMsRef.current = Date.now();
    pointsRef.current = [];
    lastAcceptedPointRef.current = null;
    distanceMetersRef.current = 0;
    baseElapsedSecondsRef.current = 0;
    segmentStartMsRef.current = Date.now();
    setDistanceMeters(0);
    setElapsedSeconds(0);
    setStatus('recording');
    startInterval();
    beginWatch();
    persist();
  }

  function pause() {
    stopWatch();
    stopInterval();
    baseElapsedSecondsRef.current = currentElapsedSeconds();
    setElapsedSeconds(baseElapsedSecondsRef.current);
    setStatus('paused');
    persist(baseElapsedSecondsRef.current);
  }

  function resume() {
    lastAcceptedPointRef.current = null;
    segmentStartMsRef.current = Date.now();
    setStatus('recording');
    startInterval();
    beginWatch();
  }

  function finish(): RecordingSummary | null {
    const finalElapsedSeconds = currentElapsedSeconds();
    stopWatch();
    stopInterval();
    setStatus('finished');

    return {
      activityType: activityTypeRef.current,
      startedAtMs: startedAtMsRef.current,
      distanceMeters: distanceMetersRef.current,
      durationSeconds: finalElapsedSeconds,
      points: pointsRef.current,
    };
  }

  function discard() {
    stopWatch();
    stopInterval();
    clearRecording();
    pointsRef.current = [];
    lastAcceptedPointRef.current = null;
    distanceMetersRef.current = 0;
    baseElapsedSecondsRef.current = 0;
    setDistanceMeters(0);
    setElapsedSeconds(0);
    setStatus('idle');
  }

  useEffect(() => {
    return () => {
      stopWatch();
      stopInterval();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { status, permissionState, distanceMeters, elapsedSeconds, start, pause, resume, finish, discard };
}
