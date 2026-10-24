import { useEffect } from 'react';
import {
  cancelAnimation,
  Easing,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { useReducedMotion } from './use-reduced-motion';

export const DEFAULT_SHIMMER_DURATION_MS = 1000;

/**
 * Drives the "erase" shimmer sweep: a 0 -> 1 value on an infinite linear loop.
 * Share one duration across every shimmering surface in an app so they all
 * move at the same speed.
 */
export function useShimmerProgress({
  durationMs = DEFAULT_SHIMMER_DURATION_MS,
  reducedMotion,
}: { durationMs?: number; reducedMotion?: boolean } = {}) {
  const fallbackReducedMotion = useReducedMotion();
  const isReducedMotion = reducedMotion ?? fallbackReducedMotion;
  const progress = useSharedValue(0);

  useEffect(() => {
    cancelAnimation(progress);

    if (isReducedMotion) {
      progress.set(0);
      return;
    }

    progress.set(
      withRepeat(withTiming(1, { duration: durationMs, easing: Easing.linear }), -1, false),
    );

    return () => {
      cancelAnimation(progress);
    };
  }, [progress, isReducedMotion, durationMs]);

  return progress;
}
