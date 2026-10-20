export type ActivityType = 'running' | 'cycling' | 'walking';

export const ACTIVITY_TYPE_LABELS: Record<ActivityType, string> = {
  running: 'Corrida',
  cycling: 'Pedalada',
  walking: 'Caminhada',
};
