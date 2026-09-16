import { useEffect } from 'react';
import {
  cancelAnimation,
  Easing,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { useReducedMotion } from '~/hooks/use-reduced-motion';

// Drives the "erase" shimmer sweep shared by ShimmerText, ShimmerProgressBar,
// and StageCrossfade's dot: a band travels left-to-right on an infinite loop.
// Centralized so every shimmering surface in the app moves at the same speed.
export const SHIMMER_DURATION_MS = 1000;

export function useShimmerProgress(reducedMotion?: boolean) {
  const fallbackReducedMotion = useReducedMotion();
  const isReducedMotion = reducedMotion ?? fallbackReducedMotion;
  const progress = useSharedValue(0);

  useEffect(() => {
    cancelAnimation(progress);

    if (isReducedMotion) {
      progress.value = 0;
      return;
    }

    progress.value = withRepeat(
      withTiming(1, { duration: SHIMMER_DURATION_MS, easing: Easing.linear }),
      -1,
      false,
    );

    return () => {
      cancelAnimation(progress);
    };
  }, [progress, isReducedMotion]);

  return progress;
}
