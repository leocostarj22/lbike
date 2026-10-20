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
