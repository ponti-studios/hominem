import type { EmptyInput } from './empty-input.types';

export type UserDeleteAccountInput = EmptyInput;
export type UserDeleteAccountOutput = {
  success: boolean;
  error?: string | undefined;
};
