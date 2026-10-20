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
        <div className="space-y-4 p-6 text-center">
          <p>Registo demasiado curto para guardar.</p>
          <button
            onClick={handleDiscard}
            className="rounded-full border border-white/20 px-4 py-2 font-semibold"
          >
            Descartar
          </button>
        </div>
      );
    }

    return (
      <div className="space-y-4 p-6">
        <div className="flex justify-around text-center">
          <p className="text-3xl font-semibold">{formatDistanceKm(summary.distanceMeters)}</p>
          <p className="text-3xl font-semibold">{formatDuration(summary.durationSeconds)}</p>
        </div>
        {saveError && (
          <p role="alert" className="text-sm text-red-400">
            {saveError}
          </p>
        )}
        <div className="space-y-1">
          <label htmlFor="title" className="block text-sm">
            Título (opcional)
          </label>
          <input
            id="title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className="w-full rounded border border-white/20 bg-transparent px-3 py-2"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="description" className="block text-sm">
            Descrição (opcional)
          </label>
          <input
            id="description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            className="w-full rounded border border-white/20 bg-transparent px-3 py-2"
          />
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex-1 rounded-full bg-accent px-4 py-2 font-semibold text-background disabled:opacity-50"
          >
            Guardar
          </button>
          <button
            onClick={handleDiscard}
            className="flex-1 rounded-full border border-white/20 px-4 py-2 font-semibold"
          >
            Descartar
          </button>
        </div>
      </div>
    );
  }

  if (recorder.permissionState === 'denied') {
    return (
      <p className="p-6 text-center">
        Permissão de localização negada. Ativa a localização para registar.
      </p>
    );
  }

  if (recorder.permissionState === 'unsupported') {
    return (
      <p className="p-6 text-center">O teu dispositivo ou browser não suporta GPS para registar atividades.</p>
    );
  }

  if (recorder.status === 'idle') {
    return (
      <div className="space-y-6 p-6 text-center">
        <div className="flex justify-center gap-3">
          {(Object.keys(ACTIVITY_TYPE_LABELS) as ActivityType[]).map((type) => (
            <button
              key={type}
              aria-pressed={type === selectedType}
              onClick={() => setSelectedType(type)}
              className={`rounded-full border px-4 py-2 font-semibold ${
                type === selectedType ? 'border-accent text-accent' : 'border-white/20'
              }`}
            >
              {ACTIVITY_TYPE_LABELS[type]}
            </button>
          ))}
        </div>
        <button
          onClick={() => recorder.start(selectedType)}
          className="rounded-full bg-accent px-8 py-3 text-lg font-semibold text-background"
        >
          Iniciar
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 text-center">
      <div className="flex justify-around">
        <p className="text-4xl font-semibold">{formatDistanceKm(recorder.distanceMeters)}</p>
        <p className="text-4xl font-semibold">{formatDuration(recorder.elapsedSeconds)}</p>
      </div>
      <div className="flex justify-center gap-3">
        {recorder.status === 'recording' ? (
          <button
            onClick={recorder.pause}
            className="rounded-full border border-white/20 px-4 py-2 font-semibold"
          >
            Pausar
          </button>
        ) : (
          <button
            onClick={recorder.resume}
            className="rounded-full bg-accent px-4 py-2 font-semibold text-background"
          >
            Retomar
          </button>
        )}
        <button
          onClick={handleFinish}
          className="rounded-full bg-accent px-4 py-2 font-semibold text-background"
        >
          Terminar
        </button>
        <button
          onClick={handleDiscard}
          className="rounded-full border border-white/20 px-4 py-2 font-semibold"
        >
          Descartar
        </button>
      </div>
    </div>
  );
}
