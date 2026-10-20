import { useEffect } from 'react';

export function useWakeLock(active: boolean): { supported: boolean } {
  const supported = typeof navigator !== 'undefined' && 'wakeLock' in navigator;

  useEffect(() => {
    if (!supported || !active) {
      return;
    }

    let lock: { release: () => Promise<void> } | undefined;
    let cancelled = false;

    navigator.wakeLock.request('screen').then((acquired) => {
      if (cancelled) {
        acquired.release();
        return;
      }
      lock = acquired;
    });

    return () => {
      cancelled = true;
      lock?.release();
    };
  }, [active, supported]);

  return { supported };
}
