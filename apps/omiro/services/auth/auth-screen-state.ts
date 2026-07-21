export interface AuthScreenStateInput {
  isPending: boolean;
  authError: string | null;
}

export interface AuthScreenStateOutput {
  isProbing: boolean;
  displayError: string | null;
}

export function resolveAuthScreenState(input: AuthScreenStateInput): AuthScreenStateOutput {
  return {
    isProbing: input.isPending,
    displayError: input.authError,
  };
}
