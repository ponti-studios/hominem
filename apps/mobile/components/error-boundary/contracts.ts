export function createFeatureFallbackLabel(featureName?: string): string {
  return `${featureName || 'Feature'} is unavailable`;
}

export function createRootFallbackMessage(error: Error | null): string {
  return error?.message || 'An unexpected error occurred';
}
