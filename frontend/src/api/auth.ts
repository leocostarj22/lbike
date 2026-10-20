import { request } from './client';

export interface User {
  id: number;
  name: string;
  email: string;
}

export async function registerRequest(
  name: string,
  email: string,
  password: string,
  passwordConfirmation: string
): Promise<{ user: User; token: string }> {
  return request('/register', {
    method: 'POST',
    body: { name, email, password, password_confirmation: passwordConfirmation } as unknown as BodyInit,
  });
}

export async function loginRequest(
  email: string,
  password: string
): Promise<{ user: User; token: string }> {
  return request('/login', {
    method: 'POST',
    body: { email, password } as unknown as BodyInit,
  });
}

export async function meRequest(token: string): Promise<{ user: User }> {
  return request('/me', {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function logoutRequest(token: string): Promise<void> {
  return request('/logout', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
}
