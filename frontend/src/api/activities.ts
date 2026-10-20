import { request } from './client';

export type ActivityType = 'running' | 'cycling' | 'walking';

export interface ActivityPointInput {
  lat: number;
  lng: number;
  altitude?: number;
  recorded_at: string;
}

export interface Activity {
  id: number;
  type: ActivityType;
  title: string | null;
  description: string | null;
  started_at: string;
  distance_meters: number;
  duration_seconds: number;
  moving_seconds: number;
  elevation_gain_meters: number | null;
  visibility: string;
  created_at: string;
}

export async function createActivityRequest(
  token: string,
  payload: {
    type: ActivityType;
    started_at: string;
    distance_meters: number;
    duration_seconds: number;
    moving_seconds: number;
    title?: string;
    description?: string;
    points: ActivityPointInput[];
  }
): Promise<{ activity: Activity }> {
  return request('/activities', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: payload as unknown as BodyInit,
  });
}

export async function listActivitiesRequest(token: string): Promise<{ activities: Activity[] }> {
  return request('/activities', {
    headers: { Authorization: `Bearer ${token}` },
  });
}
