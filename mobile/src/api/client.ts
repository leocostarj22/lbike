export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

const BASE_URL = process.env.EXPO_PUBLIC_API_URL;

export async function request(path: string, options: RequestInit = {}): Promise<unknown> {
  let response: Response;

  try {
    response = await fetch(`${BASE_URL}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });
  } catch (error) {
    throw new ApiError((error as Error).message, 0);
  }

  const body = response.status === 204 ? null : await response.json();

  if (!response.ok) {
    throw new ApiError(body?.message ?? 'Request failed.', response.status);
  }

  return body;
}
