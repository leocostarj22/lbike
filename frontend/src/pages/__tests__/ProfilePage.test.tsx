import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, test, expect, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import ProfilePage from '../ProfilePage';
import * as useAuthModule from '../../auth/AuthContext';

vi.mock('../../auth/AuthContext');

describe('ProfilePage', () => {
  test('shows the logged-in user and logs out on request', async () => {
    const logout = vi.fn().mockResolvedValue(undefined);
    vi.mocked(useAuthModule.useAuth).mockReturnValue({ user: { id: 1, name: 'Lucas', email: 'l@e.com' }, isLoading: false, login: vi.fn(), register: vi.fn(), logout });
    const user = userEvent.setup();
    render(<MemoryRouter><ProfilePage /></MemoryRouter>);

    expect(screen.getByText('Lucas')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Terminar sessao' }));
    await waitFor(() => expect(logout).toHaveBeenCalled());
  });
});
