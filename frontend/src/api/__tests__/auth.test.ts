import { describe, test, expect, vi, beforeEach } from 'vitest';
import { registerRequest, meRequest } from '../auth';

beforeEach(() => { vi.stubGlobal('fetch', vi.fn()); });

describe('registerRequest', () => {
  test('posts the confirmed password field the backend expects', async () => {
    (fetch as any).mockResolvedValue({ ok: true, status: 201, json: async () => ({ user: { id: 1, name: 'Lucas', email: 'l@e.com' }, token: 'abc' }) });
    await registerRequest('Lucas', 'l@e.com', 'password123', 'password123');
    const [, options] = (fetch as any).mock.calls[0];
    expect(JSON.parse(options.body)).toEqual({ name: 'Lucas', email: 'l@e.com', password: 'password123', password_confirmation: 'password123' });
  });
});

describe('meRequest', () => {
  test('sends the bearer token', async () => {
    (fetch as any).mockResolvedValue({ ok: true, status: 200, json: async () => ({ user: { id: 1, name: 'Lucas', email: 'l@e.com' } }) });
    await meRequest('abc');
    const [, options] = (fetch as any).mock.calls[0];
    expect(options.headers.Authorization).toBe('Bearer abc');
  });
});
