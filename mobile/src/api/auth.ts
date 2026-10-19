import { request } from './client';

export type User = {
  id: number;
  name: string;
  email: string;
};

export async function registerRequest(input: {
  name: string;
  email: string;
  password: string;
  password_confirmation: string;
}): Promise<{ user: User; token: string }> {
  return (await request('/register', {
    method: 'POST',
    body: JSON.stringify(input),
  })) as { user: User; token: string };
}

export async function loginRequest(input: {
  email: string;
  password: string;
}): Promise<{ user: User; token: string }> {
  return (await request('/login', {
    method: 'POST',
    body: JSON.stringify(input),
  })) as { user: User; token: string };
}

export async function meRequest(token: string): Promise<{ user: User }> {
  return (await request('/me', {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  })) as { user: User };
}

export async function logoutRequest(token: string): Promise<void> {
  await request('/logout', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
}
