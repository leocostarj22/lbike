import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, test, expect, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import RegisterPage from '../RegisterPage';
import * as useAuthModule from '../../auth/AuthContext';

vi.mock('../../auth/AuthContext');

describe('RegisterPage', () => {
  test('shows field-level errors from a 422 response', async () => {
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

    await waitFor(() => expect(screen.getByText('The email has already been taken.')).toBeInTheDocument());
  });
});
