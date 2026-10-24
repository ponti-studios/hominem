import { useShimmerProgress as useKitShimmerProgress } from '@hominem/rn-kit';

// Thin wrapper kept so existing call sites (`useShimmerProgress(reducedMotion)`) don't change.
export function useShimmerProgress(reducedMotion?: boolean) {
  return useKitShimmerProgress({ reducedMotion });
}
