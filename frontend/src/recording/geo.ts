export interface GeoPoint {
  lat: number;
  lng: number;
  altitude?: number;
  timestampMs: number;
}

const EARTH_RADIUS_METERS = 6371000;

export function haversineDistanceMeters(a: GeoPoint, b: GeoPoint): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));

  return EARTH_RADIUS_METERS * c;
}

export const MAX_PLAUSIBLE_SPEED_MPS = 42;

export function shouldAcceptPoint(previous: GeoPoint | null, next: GeoPoint): boolean {
  if (previous === null) {
    return true;
  }

  if (next.timestampMs <= previous.timestampMs) {
    return false;
  }

  const distance = haversineDistanceMeters(previous, next);
  const seconds = (next.timestampMs - previous.timestampMs) / 1000;
  const speed = distance / seconds;

  return speed <= MAX_PLAUSIBLE_SPEED_MPS;
}

export function totalDistanceMeters(points: GeoPoint[]): number {
  if (points.length < 2) {
    return 0;
  }

  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += haversineDistanceMeters(points[i - 1], points[i]);
  }
  return total;
}
