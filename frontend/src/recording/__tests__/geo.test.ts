import { describe, test, expect } from 'vitest';
import { haversineDistanceMeters, shouldAcceptPoint, totalDistanceMeters } from '../geo';

describe('haversineDistanceMeters', () => {
  test('matches the known distance between two coordinates', () => {
    // Lisbon Rossio to Belém, ~5.9km apart (verified against the haversine formula directly)
    const a = { lat: 38.7139, lng: -9.1394, timestampMs: 0 };
    const b = { lat: 38.6975, lng: -9.2041, timestampMs: 0 };
    const distance = haversineDistanceMeters(a, b);
    expect(distance).toBeGreaterThan(5800);
    expect(distance).toBeLessThan(6000);
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
