import { useCallback, useRef } from 'react';

/** A mutable on/off flag that never triggers a render, for "already did this" bookkeeping. */
export function useLatch() {
  const latchedRef = useRef(false);
  const isLatched = useCallback(() => latchedRef.current, []);
  const latch = useCallback(() => {
    latchedRef.current = true;
  }, []);
  const release = useCallback(() => {
    latchedRef.current = false;
  }, []);
  return { isLatched, latch, release };
}
