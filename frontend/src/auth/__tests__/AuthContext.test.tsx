import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { AuthProvider, useAuth } from '../AuthContext';
import * as authApi from '../../api/auth';

vi.mock('../../api/auth', () => ({
  registerRequest: vi.fn(),
  loginRequest: vi.fn(),
  meRequest: vi.fn(),
  logoutRequest: vi.fn(),
}));

function Probe() {
  const { user, isLoading, login, logout } = useAuth();
  if (isLoading) return <div>A carregar...</div>;
  return (
    <div>
      <div>{user ? `Ola, ${user.name}` : 'Sem sessao'}</div>
      <button onClick={() => login('l@e.com', 'secret')}>Entrar</button>
      <button onClick={() => logout()}>Sair</button>
    </div>
  );
}

beforeEach(() => { localStorage.clear(); vi.clearAllMocks(); });

describe('AuthProvider', () => {
  test('starts with no stored token: not loading, no user', async () => {
    render(<AuthProvider><Probe /></AuthProvider>);
    await waitFor(() => expect(screen.getByText('Sem sessao')).toBeInTheDocument());
  });

  test('restores the session from a valid stored token', async () => {
    localStorage.setItem('lbike_token', 'abc');
    vi.mocked(authApi.meRequest).mockResolvedValue({ user: { id: 1, name: 'Lucas', email: 'l@e.com' } });
    render(<AuthProvider><Probe /></AuthProvider>);
    await waitFor(() => expect(screen.getByText('Ola, Lucas')).toBeInTheDocument());
  });

  test('clears an invalid stored token on mount', async () => {
    localStorage.setItem('lbike_token', 'expired');
    const { ApiError } = await import('../../api/client');
    vi.mocked(authApi.meRequest).mockRejectedValue(new ApiError('Unauthenticated.', 401));
    render(<AuthProvider><Probe /></AuthProvider>);
    await waitFor(() => expect(screen.getByText('Sem sessao')).toBeInTheDocument());
    expect(localStorage.getItem('lbike_token')).toBeNull();
  });

  test('keeps the stored token on a network failure at mount (no user, but token survives for a later retry)', async () => {
    localStorage.setItem('lbike_token', 'abc');
    const { ApiError } = await import('../../api/client');
    vi.mocked(authApi.meRequest).mockRejectedValue(new ApiError('Network error', 0));
    render(<AuthProvider><Probe /></AuthProvider>);
    await waitFor(() => expect(screen.getByText('Sem sessao')).toBeInTheDocument());
    expect(localStorage.getItem('lbike_token')).toBe('abc');
  });

  test('login stores the token and user; logout clears both', async () => {
    vi.mocked(authApi.loginRequest).mockResolvedValue({ user: { id: 1, name: 'Lucas', email: 'l@e.com' }, token: 'abc' });
    vi.mocked(authApi.logoutRequest).mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<AuthProvider><Probe /></AuthProvider>);
    await waitFor(() => expect(screen.getByText('Sem sessao')).toBeInTheDocument());

    await user.click(screen.getByText('Entrar'));
    await waitFor(() => expect(screen.getByText('Ola, Lucas')).toBeInTheDocument());
    expect(localStorage.getItem('lbike_token')).toBe('abc');

    await user.click(screen.getByText('Sair'));
    await waitFor(() => expect(screen.getByText('Sem sessao')).toBeInTheDocument());
    expect(localStorage.getItem('lbike_token')).toBeNull();
  });
});
