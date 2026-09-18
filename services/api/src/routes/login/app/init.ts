export type ResumeMode = 'app' | 'oauth';

export type LoginInit = {
  mode: ResumeMode;
  resumeQuery: string;
  email: string;
  step: 'email' | 'otp';
  error?: string;
};

export type ConsentInit = {
  clientName: string;
  query: string;
  scopes: string[];
  error?: string;
};

export type LogoutInit = {
  signedOut: boolean;
};

export type ErrorInit = {
  description?: string;
  error?: string;
  mode?: ResumeMode;
};

export type SettingsInit = {
  user: { id: string; name: string | null; email: string | null };
  loginNextUrl: string;
};

type AuthWindow = {
  __AUTH_INIT__?: unknown;
};

export function readAuthInit<T>(): T {
  return (window as unknown as AuthWindow).__AUTH_INIT__ as T;
}
