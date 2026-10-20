import { describe, test, expect, vi, beforeEach } from 'vitest';
import { createActivityRequest, listActivitiesRequest } from '../activities';

beforeEach(() => { vi.stubGlobal('fetch', vi.fn()); });

describe('createActivityRequest', () => {
  test('posts the activity payload with the bearer token', async () => {
    (fetch as any).mockResolvedValue({ ok: true, status: 201, json: async () => ({ activity: { id: 1 } }) });
    await createActivityRequest('tok', {
      type: 'cycling',
      started_at: '2026-10-20T10:00:00Z',
      distance_meters: 1000,
      duration_seconds: 300,
      moving_seconds: 300,
      points: [{ lat: 1, lng: 2, recorded_at: '2026-10-20T10:00:00Z' }],
    });
    const [url, options] = (fetch as any).mock.calls[0];
    expect(url).toContain('/activities');
    expect(options.headers.Authorization).toBe('Bearer tok');
    expect(JSON.parse(options.body).type).toBe('cycling');
  });
});

describe('listActivitiesRequest', () => {
  test('sends the bearer token', async () => {
    (fetch as any).mockResolvedValue({ ok: true, status: 200, json: async () => ({ activities: [] }) });
    await listActivitiesRequest('tok');
    const [, options] = (fetch as any).mock.calls[0];
    expect(options.headers.Authorization).toBe('Bearer tok');
  });
});
