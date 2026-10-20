import { describe, test, expect, vi, beforeEach } from 'vitest';
import { request } from '../client';

beforeEach(() => { vi.stubGlobal('fetch', vi.fn()); });

describe('request', () => {
  test('returns parsed JSON on success', async () => {
    (fetch as any).mockResolvedValue({ ok: true, status: 200, json: async () => ({ hello: 'world' }) });
    await expect(request('/ping')).resolves.toEqual({ hello: 'world' });
  });

  test('returns undefined for a 204 response without parsing JSON', async () => {
    (fetch as any).mockResolvedValue({ ok: true, status: 204, json: async () => { throw new Error('should not be called'); } });
    await expect(request('/logout', { method: 'POST' })).resolves.toBeUndefined();
  });

  test('throws ApiError with the server message on a non-2xx response', async () => {
    (fetch as any).mockResolvedValue({ ok: false, status: 401, json: async () => ({ message: 'Invalid credentials.' }) });
    await expect(request('/login')).rejects.toMatchObject({ message: 'Invalid credentials.', status: 401 });
  });

  test('throws a network ApiError when fetch itself rejects', async () => {
    (fetch as any).mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(request('/ping')).rejects.toMatchObject({ status: 0 });
  });

  test('throws a clean ApiError when an error response has a non-JSON body (e.g. a tunnel outage HTML page)', async () => {
    (fetch as any).mockResolvedValue({
      ok: false,
      status: 502,
      json: async () => { throw new SyntaxError('Unexpected token <'); },
    });
    await expect(request('/ping')).rejects.toMatchObject({ status: 502 });
    await expect(request('/ping')).rejects.toBeInstanceOf((await import('../client')).ApiError);
  });
});
