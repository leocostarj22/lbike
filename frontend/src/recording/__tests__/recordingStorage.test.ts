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
