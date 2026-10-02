import { useCallback, useEffect, useRef } from 'react';

/**
 * A single replaceable timeout. Scheduling replaces any pending one, and a
 * pending one is cleared on unmount.
 */
export function useTimerSlot() {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clear = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const schedule = useCallback(
    (callback: () => void, delayMs: number) => {
      clear();
      timerRef.current = setTimeout(callback, delayMs);
    },
    [clear],
  );

  useEffect(() => clear, [clear]);

  return { clear, schedule };
}
