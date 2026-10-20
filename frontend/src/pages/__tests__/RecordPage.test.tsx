import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import RecordPage from '../RecordPage';
import * as useAuthModule from '../../auth/AuthContext';
import * as recorderModule from '../../recording/useActivityRecorder';
import * as activitiesApi from '../../api/activities';
import { saveRecording } from '../../recording/recordingStorage';
import { ApiError } from '../../api/client';

vi.mock('../../auth/AuthContext');
vi.mock('../../recording/useActivityRecorder');
vi.mock('../../api/activities');

function mockRecorder(overrides: Partial<ReturnType<typeof recorderModule.useActivityRecorder>>) {
  vi.mocked(recorderModule.useActivityRecorder).mockReturnValue({
    status: 'idle', permissionState: 'unknown', distanceMeters: 0, elapsedSeconds: 0,
    start: vi.fn(), pause: vi.fn(), resume: vi.fn(), finish: vi.fn(), discard: vi.fn(),
    ...overrides,
  } as any);
}

function renderRecordPage() {
  return render(
    <MemoryRouter initialEntries={['/record']}>
      <Routes>
        <Route path="/record" element={<RecordPage />} />
        <Route path="/activities" element={<div>Ecrã de atividades</div>} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  localStorage.clear();
  vi.mocked(useAuthModule.useAuth).mockReturnValue({
    user: { id: 1, name: 'Lucas', email: 'l@e.com' }, isLoading: false, token: 'tok',
    login: vi.fn(), register: vi.fn(), logout: vi.fn(),
  } as any);
});

describe('RecordPage', () => {
  test('shows the activity type picker and Start when idle', () => {
    mockRecorder({ status: 'idle' });
    renderRecordPage();
    expect(screen.getByText('Pedalada')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Iniciar' })).toBeInTheDocument();
  });

  test('shows live distance and elapsed time while recording', () => {
    mockRecorder({ status: 'recording', distanceMeters: 1500, elapsedSeconds: 75 });
    renderRecordPage();
    expect(screen.getByText('1.5 km')).toBeInTheDocument();
    expect(screen.getByText('01:15')).toBeInTheDocument();
  });

  test('shows a clear message when permission is denied', () => {
    mockRecorder({ status: 'idle', permissionState: 'denied' });
    renderRecordPage();
    expect(screen.getByText(/Permissão de localização negada/)).toBeInTheDocument();
  });

  test('finishing with too few points disables saving instead of calling the API', async () => {
    const finish = vi.fn().mockReturnValue({ activityType: 'cycling', startedAtMs: 1000, distanceMeters: 0, durationSeconds: 3, points: [{ lat: 1, lng: 2, timestampMs: 1000 }] });
    mockRecorder({ status: 'recording', finish });
    const user = userEvent.setup();
    renderRecordPage();

    await user.click(screen.getByRole('button', { name: 'Terminar' }));

    expect(screen.getByText('Registo demasiado curto para guardar.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Guardar' })).not.toBeInTheDocument();
  });

  test('saving the summary calls the API, clears the persisted recording, and navigates to /activities', async () => {
    saveRecording({ activityType: 'cycling', startedAtMs: 1000, points: [{ lat: 1, lng: 2, timestampMs: 1000 }], elapsedSeconds: 300, distanceMeters: 1500 });
    const finish = vi.fn().mockReturnValue({
      activityType: 'cycling', startedAtMs: 1000, distanceMeters: 1500, durationSeconds: 300,
      points: [{ lat: 1, lng: 2, timestampMs: 1000 }, { lat: 1.001, lng: 2.001, timestampMs: 2000 }],
    });
    mockRecorder({ status: 'recording', finish });
    vi.mocked(activitiesApi.createActivityRequest).mockResolvedValue({ activity: { id: 1 } as any });
    const user = userEvent.setup();
    renderRecordPage();

    await user.click(screen.getByRole('button', { name: 'Terminar' }));
    await user.type(screen.getByLabelText('Título (opcional)'), 'Volta no parque');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    await waitFor(() => expect(activitiesApi.createActivityRequest).toHaveBeenCalledWith('tok', expect.objectContaining({
      type: 'cycling', distance_meters: 1500, duration_seconds: 300, title: 'Volta no parque',
    })));
    await waitFor(() => expect(screen.getByText('Ecrã de atividades')).toBeInTheDocument());
    expect(localStorage.getItem('lbike_recording')).toBeNull();
  });

  test('shows an error and lets the user retry when saving fails', async () => {
    const finish = vi.fn().mockReturnValue({
      activityType: 'cycling', startedAtMs: 1000, distanceMeters: 1500, durationSeconds: 300,
      points: [{ lat: 1, lng: 2, timestampMs: 1000 }, { lat: 1.001, lng: 2.001, timestampMs: 2000 }],
    });
    mockRecorder({ status: 'recording', finish });
    vi.mocked(activitiesApi.createActivityRequest).mockRejectedValue(new ApiError('Network error', 0));
    const user = userEvent.setup();
    renderRecordPage();

    await user.click(screen.getByRole('button', { name: 'Terminar' }));
    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    await waitFor(() => expect(screen.getByText('Sem ligação à internet. Tenta novamente.')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Guardar' })).not.toBeDisabled();
  });
});
