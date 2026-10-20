import type { GeoPoint } from './geo';
import type { ActivityType } from './activityTypes';

const STORAGE_KEY = 'lbike_recording';

export interface StoredRecording {
  activityType: ActivityType;
  startedAtMs: number;
  points: GeoPoint[];
  elapsedSeconds: number;
}

export function saveRecording(data: StoredRecording): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function loadRecording(): StoredRecording | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw === null) {
    return null;
  }

  try {
    return JSON.parse(raw) as StoredRecording;
  } catch {
    clearRecording();
    return null;
  }
}

export function clearRecording(): void {
  localStorage.removeItem(STORAGE_KEY);
}
