import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { useActivityRecorder, type RecordingSummary } from '../recording/useActivityRecorder';
import { useWakeLock } from '../recording/useWakeLock';
import { ACTIVITY_TYPE_LABELS, type ActivityType } from '../recording/activityTypes';
import { formatDistanceKm, formatDuration } from '../recording/format';
import { createActivityRequest } from '../api/activities';
import { clearRecording } from '../recording/recordingStorage';
import { friendlyErrorMessage } from '../api/errorMessages';

export default function RecordPage() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const recorder = useActivityRecorder();
  useWakeLock(recorder.status === 'recording');

  const [selectedType, setSelectedType] = useState<ActivityType>('cycling');
  const [summary, setSummary] = useState<RecordingSummary | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  function handleFinish() {
    setSummary(recorder.finish());
  }

  function handleDiscard() {
    setSummary(null);
    recorder.discard();
  }

  async function handleSave() {
    if (!summary || !token || isSaving) {
      return;
    }

    setIsSaving(true);
    setSaveError(null);
    try {
      await createActivityRequest(token, {
        type: summary.activityType,
        started_at: new Date(summary.startedAtMs).toISOString(),
        distance_meters: summary.distanceMeters,
        duration_seconds: summary.durationSeconds,
        moving_seconds: summary.durationSeconds,
        title: title || undefined,
        description: description || undefined,
        points: summary.points.map((point) => ({
          lat: point.lat,
          lng: point.lng,
          altitude: point.altitude,
          recorded_at: new Date(point.timestampMs).toISOString(),
        })),
      });
      clearRecording();
      navigate('/activities');
    } catch (err) {
      setSaveError(friendlyErrorMessage(err));
    } finally {
      setIsSaving(false);
    }
  }

  if (summary) {
    if (summary.points.length < 2) {
      return (
        <div>
          <p>Registo demasiado curto para guardar.</p>
          <button onClick={handleDiscard}>Descartar</button>
        </div>
      );
    }

    return (
      <div>
        <p>{formatDistanceKm(summary.distanceMeters)}</p>
        <p>{formatDuration(summary.durationSeconds)}</p>
        {saveError && <p role="alert">{saveError}</p>}
        <label htmlFor="title">Título (opcional)</label>
        <input id="title" value={title} onChange={(event) => setTitle(event.target.value)} />
        <label htmlFor="description">Descrição (opcional)</label>
        <input
          id="description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
        <button onClick={handleSave} disabled={isSaving}>
          Guardar
        </button>
        <button onClick={handleDiscard}>Descartar</button>
      </div>
    );
  }

  if (recorder.permissionState === 'denied') {
    return <p>Permissão de localização negada. Ativa a localização para registar.</p>;
  }

  if (recorder.permissionState === 'unsupported') {
    return <p>O teu dispositivo ou browser não suporta GPS para registar atividades.</p>;
  }

  if (recorder.status === 'idle') {
    return (
      <div>
        {(Object.keys(ACTIVITY_TYPE_LABELS) as ActivityType[]).map((type) => (
          <button
            key={type}
            aria-pressed={type === selectedType}
            onClick={() => setSelectedType(type)}
          >
            {ACTIVITY_TYPE_LABELS[type]}
          </button>
        ))}
        <button onClick={() => recorder.start(selectedType)}>Iniciar</button>
      </div>
    );
  }

  return (
    <div>
      <p>{formatDistanceKm(recorder.distanceMeters)}</p>
      <p>{formatDuration(recorder.elapsedSeconds)}</p>
      {recorder.status === 'recording' ? (
        <button onClick={recorder.pause}>Pausar</button>
      ) : (
        <button onClick={recorder.resume}>Retomar</button>
      )}
      <button onClick={handleFinish}>Terminar</button>
      <button onClick={handleDiscard}>Descartar</button>
    </div>
  );
}
