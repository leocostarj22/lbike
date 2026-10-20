import { render, screen, waitFor } from '@testing-library/react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import ActivitiesPage from '../ActivitiesPage';
import * as useAuthModule from '../../auth/AuthContext';
import * as activitiesApi from '../../api/activities';
import { ApiError } from '../../api/client';

vi.mock('../../auth/AuthContext');
vi.mock('../../api/activities');

beforeEach(() => {
  vi.mocked(useAuthModule.useAuth).mockReturnValue({
    user: { id: 1, name: 'Lucas', email: 'l@e.com' }, isLoading: false, token: 'tok',
    login: vi.fn(), register: vi.fn(), logout: vi.fn(),
  } as any);
});

describe('ActivitiesPage', () => {
  test('lists the saved activities', async () => {
    vi.mocked(activitiesApi.listActivitiesRequest).mockResolvedValue({
      activities: [
        { id: 1, type: 'cycling', title: 'Volta no parque', description: null, started_at: '2026-10-20T10:00:00Z', distance_meters: 1500, duration_seconds: 300, moving_seconds: 300, elevation_gain_meters: null, visibility: 'private', created_at: '2026-10-20T10:05:00Z' },
      ],
    });
    render(<MemoryRouter><ActivitiesPage /></MemoryRouter>);

    await waitFor(() => expect(screen.getByText('Volta no parque')).toBeInTheDocument());
    expect(screen.getByText('Pedalada')).toBeInTheDocument();
    expect(screen.getByText('1.5 km')).toBeInTheDocument();
    expect(screen.getByText('05:00')).toBeInTheDocument();
  });

  test('shows an empty state for a new account', async () => {
    vi.mocked(activitiesApi.listActivitiesRequest).mockResolvedValue({ activities: [] });
    render(<MemoryRouter><ActivitiesPage /></MemoryRouter>);

    await waitFor(() => expect(screen.getByText('Ainda não tens atividades registadas.')).toBeInTheDocument());
  });

  test('shows an error instead of loading forever when the request fails', async () => {
    vi.mocked(activitiesApi.listActivitiesRequest).mockRejectedValue(new ApiError('Network error', 0));
    render(<MemoryRouter><ActivitiesPage /></MemoryRouter>);

    await waitFor(() => expect(screen.getByText('Sem ligação à internet. Tenta novamente.')).toBeInTheDocument());
  });
});
