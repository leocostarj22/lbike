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
    return <p role="alert">{error}</p>;
  }

  if (activities === null) {
    return <p>A carregar...</p>;
  }

  if (activities.length === 0) {
    return <p>Ainda não tens atividades registadas.</p>;
  }

  return (
    <ul>
      {activities.map((activity) => (
        <li key={activity.id}>
          <p>{ACTIVITY_TYPE_LABELS[activity.type]}</p>
          <p>{activity.title ?? 'Sem título'}</p>
          <p>{formatDistanceKm(activity.distance_meters)}</p>
          <p>{formatDuration(activity.duration_seconds)}</p>
        </li>
      ))}
    </ul>
  );
}
