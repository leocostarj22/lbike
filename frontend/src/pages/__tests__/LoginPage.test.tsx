import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, test, expect, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import LoginPage from '../LoginPage';
import * as useAuthModule from '../../auth/AuthContext';

vi.mock('../../auth/AuthContext');

describe('LoginPage', () => {
  test('submits the entered credentials', async () => {
    const login = vi.fn().mockResolvedValue(undefined);
    vi.mocked(useAuthModule.useAuth).mockReturnValue({ user: null, isLoading: false, login, register: vi.fn(), logout: vi.fn() });
    const user = userEvent.setup();
    render(<MemoryRouter><LoginPage /></MemoryRouter>);

    await user.type(screen.getByLabelText('Email'), 'l@e.com');
    await user.type(screen.getByLabelText('Palavra-passe'), 'secret123');
    await user.click(screen.getByRole('button', { name: 'Entrar' }));

    await waitFor(() => expect(login).toHaveBeenCalledWith('l@e.com', 'secret123'));
  });

  test('shows a translated message when the credentials are wrong', async () => {
    const { ApiError } = await import('../../api/client');
    const login = vi.fn().mockRejectedValue(new ApiError('Invalid credentials.', 401));
    vi.mocked(useAuthModule.useAuth).mockReturnValue({ user: null, isLoading: false, login, register: vi.fn(), logout: vi.fn() });
    const user = userEvent.setup();
    render(<MemoryRouter><LoginPage /></MemoryRouter>);

    await user.type(screen.getByLabelText('Email'), 'l@e.com');
    await user.type(screen.getByLabelText('Palavra-passe'), 'wrong');
    await user.click(screen.getByRole('button', { name: 'Entrar' }));

    await waitFor(() => expect(screen.getByText('Email ou palavra-passe incorretos.')).toBeInTheDocument());
  });

  test('shows a translated message on a network failure', async () => {
    const { ApiError } = await import('../../api/client');
    const login = vi.fn().mockRejectedValue(new ApiError('Network error', 0));
    vi.mocked(useAuthModule.useAuth).mockReturnValue({ user: null, isLoading: false, login, register: vi.fn(), logout: vi.fn() });
    const user = userEvent.setup();
    render(<MemoryRouter><LoginPage /></MemoryRouter>);

    await user.type(screen.getByLabelText('Email'), 'l@e.com');
    await user.type(screen.getByLabelText('Palavra-passe'), 'secret123');
    await user.click(screen.getByRole('button', { name: 'Entrar' }));

    await waitFor(() => expect(screen.getByText('Sem ligação à internet. Tenta novamente.')).toBeInTheDocument());
  });

  test('disables the submit button while the request is in flight', async () => {
    let resolveLogin: () => void = () => {};
    const login = vi.fn(() => new Promise<void>((resolve) => { resolveLogin = resolve; }));
    vi.mocked(useAuthModule.useAuth).mockReturnValue({ user: null, isLoading: false, login, register: vi.fn(), logout: vi.fn() });
    const user = userEvent.setup();
    render(<MemoryRouter><LoginPage /></MemoryRouter>);

    await user.type(screen.getByLabelText('Email'), 'l@e.com');
    await user.type(screen.getByLabelText('Palavra-passe'), 'secret123');
    const button = screen.getByRole('button', { name: 'Entrar' });
    await user.click(button);

    expect(button).toBeDisabled();
    await user.click(button); // a second click must not fire a second call
    expect(login).toHaveBeenCalledTimes(1);
    resolveLogin();
  });

  test('links to the register page', () => {
    vi.mocked(useAuthModule.useAuth).mockReturnValue({ user: null, isLoading: false, login: vi.fn(), register: vi.fn(), logout: vi.fn() });
    render(<MemoryRouter><LoginPage /></MemoryRouter>);

    expect(screen.getByRole('link', { name: 'Criar conta' })).toHaveAttribute('href', '/register');
  });
});
