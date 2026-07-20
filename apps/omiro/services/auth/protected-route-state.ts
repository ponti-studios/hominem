export interface ProtectedRouteStateInput {
  isPending: boolean;
  isSignedIn: boolean;
}

export interface ProtectedRouteStateOutput {
  showFallback: boolean;
}

export function resolveProtectedRouteState(
  input: ProtectedRouteStateInput,
): ProtectedRouteStateOutput {
  return {
    showFallback: input.isPending || !input.isSignedIn,
  };
}
