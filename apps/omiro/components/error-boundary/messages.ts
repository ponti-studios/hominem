export function createRootFallbackMessage(error: Error | null): string {
  return error?.message || 'An unexpected error occurred';
}
