import { useEffect, useRef, useState } from 'react';
import { type GeoPoint, shouldAcceptPoint, totalDistanceMeters } from './geo';
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

export function useActivityRecorder(watchPositionFn?: typeof navigator.geolocation.watchPosition) {
  const [status, setStatus] = useState<RecorderStatus>('idle');
  const [permissionState, setPermissionState] = useState<PermissionState>(() =>
    (watchPositionFn ?? navigator.geolocation?.watchPosition) ? 'unknown' : 'unsupported'
  );
  const [distanceMeters, setDistanceMeters] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const activityTypeRef = useRef<ActivityType>('cycling');
  const startedAtMsRef = useRef(0);
  const pointsRef = useRef<GeoPoint[]>([]);
  const watchIdRef = useRef<number | null>(null);
  const intervalIdRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const stored = loadRecording();
    if (stored) {
      activityTypeRef.current = stored.activityType;
      startedAtMsRef.current = stored.startedAtMs;
      pointsRef.current = stored.points;
      setDistanceMeters(totalDistanceMeters(stored.points));
      setElapsedSeconds(stored.elapsedSeconds);
      setStatus('paused');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function stopWatch() {
    if (watchIdRef.current !== null) {
      navigator.geolocation?.clearWatch?.(watchIdRef.current);
      watchIdRef.current = null;
    }
  }

  function stopInterval() {
    if (intervalIdRef.current !== null) {
      clearInterval(intervalIdRef.current);
      intervalIdRef.current = null;
    }
  }

  function startInterval() {
    stopInterval();
    intervalIdRef.current = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);
  }

  function beginWatch() {
    const watch = watchPositionFn ?? navigator.geolocation?.watchPosition;
    if (!watch) {
      setPermissionState('unsupported');
      setStatus('idle');
      return;
    }

    watchIdRef.current = watch(
      (position) => {
        const point: GeoPoint = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          altitude: position.coords.altitude ?? undefined,
          timestampMs: position.timestamp,
        };

        const last = pointsRef.current[pointsRef.current.length - 1] ?? null;
        if (shouldAcceptPoint(last, point)) {
          pointsRef.current = [...pointsRef.current, point];
          setDistanceMeters(totalDistanceMeters(pointsRef.current));
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
      }
    );
  }

  function persist() {
    saveRecording({
      activityType: activityTypeRef.current,
      startedAtMs: startedAtMsRef.current,
      points: pointsRef.current,
      elapsedSeconds,
    } satisfies StoredRecording);
  }

  function start(activityType: ActivityType) {
    activityTypeRef.current = activityType;
    startedAtMsRef.current = Date.now();
    pointsRef.current = [];
    setDistanceMeters(0);
    setElapsedSeconds(0);
    setStatus('recording');
    startInterval();
    beginWatch();
  }

  function pause() {
    stopWatch();
    stopInterval();
    setStatus('paused');
    persist();
  }

  function resume() {
    setStatus('recording');
    startInterval();
    beginWatch();
  }

  function finish(): RecordingSummary | null {
    stopWatch();
    stopInterval();
    setStatus('finished');

    return {
      activityType: activityTypeRef.current,
      startedAtMs: startedAtMsRef.current,
      distanceMeters: totalDistanceMeters(pointsRef.current),
      durationSeconds: elapsedSeconds,
      points: pointsRef.current,
    };
  }

  function discard() {
    stopWatch();
    stopInterval();
    clearRecording();
    pointsRef.current = [];
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
