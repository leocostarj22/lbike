import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { describe, test, expect, vi } from 'vitest';
import { ProtectedRoute } from '../ProtectedRoute';
import * as useAuthModule from '../../auth/AuthContext';

vi.mock('../../auth/AuthContext', async () => {
  const actual = await vi.importActual<typeof useAuthModule>('../../auth/AuthContext');
  return { ...actual, useAuth: vi.fn() };
});

describe('ProtectedRoute', () => {
  test('redirects to /login when there is no authenticated user', async () => {
    vi.mocked(useAuthModule.useAuth).mockReturnValue({ user: null, isLoading: false, login: vi.fn(), register: vi.fn(), logout: vi.fn() });
    render(
      <MemoryRouter initialEntries={['/profile']}>
        <Routes>
          <Route path="/login" element={<div>Pagina de login</div>} />
          <Route path="/profile" element={<ProtectedRoute><div>Perfil</div></ProtectedRoute>} />
        </Routes>
      </MemoryRouter>
    );
    await waitFor(() => expect(screen.getByText('Pagina de login')).toBeInTheDocument());
  });

  test('renders children when a user is authenticated', async () => {
    vi.mocked(useAuthModule.useAuth).mockReturnValue({ user: { id: 1, name: 'Lucas', email: 'l@e.com' }, isLoading: false, login: vi.fn(), register: vi.fn(), logout: vi.fn() });
    render(
      <MemoryRouter initialEntries={['/profile']}>
        <Routes>
          <Route path="/profile" element={<ProtectedRoute><div>Perfil</div></ProtectedRoute>} />
        </Routes>
      </MemoryRouter>
    );
    await waitFor(() => expect(screen.getByText('Perfil')).toBeInTheDocument());
  });
});
