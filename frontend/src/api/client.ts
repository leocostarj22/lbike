export class ApiError extends Error {
  status: number;
  errors?: Record<string, string[]>;

  constructor(message: string, status: number, errors?: Record<string, string[]>) {
    super(message);
    this.status = status;
    this.errors = errors;
  }
}

const API_URL = import.meta.env.VITE_API_URL as string;

export async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };

  const body =
    options.body && typeof options.body === 'object' ? JSON.stringify(options.body) : options.body;

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, { ...options, headers, body });
  } catch {
    throw new ApiError('Network error', 0);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  let data: { message?: string; errors?: Record<string, string[]> } = {};
  try {
    data = await response.json();
  } catch {
    if (!response.ok) {
      throw new ApiError('Request failed', response.status);
    }
    throw new ApiError('Invalid server response', response.status);
  }

  if (!response.ok) {
    throw new ApiError(data.message ?? 'Request failed', response.status, data.errors);
  }

  return data as T;
}
