import { loginRequest } from '../auth';

describe('loginRequest', () => {
  it('posts credentials and returns the parsed user and token', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ user: { id: 1, name: 'Lucas', email: 'lucas@example.com' }, token: 'abc' }),
    }) as jest.Mock;

    const result = await loginRequest({ email: 'lucas@example.com', password: 'password123' });

    expect(result).toEqual({ user: { id: 1, name: 'Lucas', email: 'lucas@example.com' }, token: 'abc' });
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/login'),
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('throws ApiError with the response status on a non-2xx response', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ message: 'Invalid credentials.' }),
    }) as jest.Mock;

    await expect(loginRequest({ email: 'x@example.com', password: 'bad' }))
      .rejects.toMatchObject({ status: 401, message: 'Invalid credentials.' });
  });

  it('throws ApiError with status 0 when the network request itself fails', async () => {
    global.fetch = jest.fn().mockRejectedValue(new TypeError('Network request failed'));

    await expect(loginRequest({ email: 'x@example.com', password: 'bad' }))
      .rejects.toMatchObject({ status: 0 });
  });
});
