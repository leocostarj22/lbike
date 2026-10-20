import { renderHook } from '@testing-library/react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { useWakeLock } from '../useWakeLock';

describe('useWakeLock', () => {
  beforeEach(() => {
    // @ts-expect-error test-only global
    delete navigator.wakeLock;
  });

  test('reports unsupported and does nothing when the API is missing', () => {
    const { result } = renderHook(() => useWakeLock(true));
    expect(result.current.supported).toBe(false);
  });

  test('requests a lock on activation and releases it on deactivation', async () => {
    const release = vi.fn().mockResolvedValue(undefined);
    const request = vi.fn().mockResolvedValue({ release });
    // @ts-expect-error test-only global
    navigator.wakeLock = { request };

    const { result, rerender } = renderHook(({ active }) => useWakeLock(active), { initialProps: { active: false } });
    expect(result.current.supported).toBe(true);
    expect(request).not.toHaveBeenCalled();

    rerender({ active: true });
    await vi.waitFor(() => expect(request).toHaveBeenCalledWith('screen'));

    rerender({ active: false });
    await vi.waitFor(() => expect(release).toHaveBeenCalled());
  });
});
