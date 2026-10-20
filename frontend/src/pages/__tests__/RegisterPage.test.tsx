import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, test, expect, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import RegisterPage from '../RegisterPage';
import * as useAuthModule from '../../auth/AuthContext';

vi.mock('../../auth/AuthContext');

describe('RegisterPage', () => {
  test('shows a field-level error next to the field it belongs to', async () => {
    const { ApiError } = await import('../../api/client');
    const register = vi.fn().mockRejectedValue(
      new ApiError('The email has already been taken.', 422, { email: ['The email has already been taken.'] })
    );
    vi.mocked(useAuthModule.useAuth).mockReturnValue({ user: null, isLoading: false, login: vi.fn(), register, logout: vi.fn() });
    const user = userEvent.setup();
    render(<MemoryRouter><RegisterPage /></MemoryRouter>);

    await user.type(screen.getByLabelText('Nome'), 'Lucas');
    await user.type(screen.getByLabelText('Email'), 'l@e.com');
    await user.type(screen.getByLabelText('Palavra-passe'), 'secret123');
    await user.type(screen.getByLabelText('Confirmar palavra-passe'), 'secret123');
    await user.click(screen.getByRole('button', { name: 'Criar conta' }));

    const emailInput = await screen.findByLabelText('Email');
    await waitFor(() => expect(emailInput).toHaveAttribute('aria-invalid', 'true'));
    const describedBy = emailInput.getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();
    expect(document.getElementById(describedBy!)).toHaveTextContent('The email has already been taken.');
  });

  test('shows a translated message on a network failure', async () => {
    const { ApiError } = await import('../../api/client');
    const register = vi.fn().mockRejectedValue(new ApiError('Network error', 0));
    vi.mocked(useAuthModule.useAuth).mockReturnValue({ user: null, isLoading: false, login: vi.fn(), register, logout: vi.fn() });
    const user = userEvent.setup();
    render(<MemoryRouter><RegisterPage /></MemoryRouter>);

    await user.type(screen.getByLabelText('Nome'), 'Lucas');
    await user.type(screen.getByLabelText('Email'), 'l@e.com');
    await user.type(screen.getByLabelText('Palavra-passe'), 'secret123');
    await user.type(screen.getByLabelText('Confirmar palavra-passe'), 'secret123');
    await user.click(screen.getByRole('button', { name: 'Criar conta' }));

    await waitFor(() => expect(screen.getByText('Sem ligação à internet. Tenta novamente.')).toBeInTheDocument());
  });

  test('disables the submit button while the request is in flight', async () => {
    let resolveRegister: () => void = () => {};
    const register = vi.fn(() => new Promise<void>((resolve) => { resolveRegister = resolve; }));
    vi.mocked(useAuthModule.useAuth).mockReturnValue({ user: null, isLoading: false, login: vi.fn(), register, logout: vi.fn() });
    const user = userEvent.setup();
    render(<MemoryRouter><RegisterPage /></MemoryRouter>);

    await user.type(screen.getByLabelText('Nome'), 'Lucas');
    await user.type(screen.getByLabelText('Email'), 'l@e.com');
    await user.type(screen.getByLabelText('Palavra-passe'), 'secret123');
    await user.type(screen.getByLabelText('Confirmar palavra-passe'), 'secret123');
    const button = screen.getByRole('button', { name: 'Criar conta' });
    await user.click(button);

    expect(button).toBeDisabled();
    await user.click(button);
    expect(register).toHaveBeenCalledTimes(1);
    resolveRegister();
  });

  test('links to the login page', () => {
    vi.mocked(useAuthModule.useAuth).mockReturnValue({ user: null, isLoading: false, login: vi.fn(), register: vi.fn(), logout: vi.fn() });
    render(<MemoryRouter><RegisterPage /></MemoryRouter>);

    expect(screen.getByRole('link', { name: 'Entrar' })).toHaveAttribute('href', '/login');
  });
});
