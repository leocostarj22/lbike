import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { listActivitiesRequest, type Activity } from '../api/activities';
import { ACTIVITY_TYPE_LABELS } from '../recording/activityTypes';
import { formatDistanceKm, formatDuration } from '../recording/format';
import { friendlyErrorMessage } from '../api/errorMessages';

export default function ActivitiesPage() {
  const { token } = useAuth();
  const [activities, setActivities] = useState<Activity[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      return;
    }
    listActivitiesRequest(token)
      .then(({ activities }) => setActivities(activities))
      .catch((err) => setError(friendlyErrorMessage(err)));
  }, [token]);

  if (error) {
    return (
      <p role="alert" className="p-6 text-center text-sm text-red-400">
        {error}
      </p>
    );
  }

  if (activities === null) {
    return <p className="p-6 text-center">A carregar...</p>;
  }

  if (activities.length === 0) {
    return <p className="p-6 text-center">Ainda não tens atividades registadas.</p>;
  }

  return (
    <ul className="space-y-3 p-6">
      {activities.map((activity) => (
        <li key={activity.id} className="rounded-lg border border-white/10 p-4">
          <p className="text-sm text-accent">{ACTIVITY_TYPE_LABELS[activity.type]}</p>
          <p className="font-semibold">{activity.title ?? 'Sem título'}</p>
          <div className="mt-1 flex gap-4 text-sm text-white/70">
            <p>{formatDistanceKm(activity.distance_meters)}</p>
            <p>{formatDuration(activity.duration_seconds)}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}
