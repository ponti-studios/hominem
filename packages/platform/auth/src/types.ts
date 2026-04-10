import type { getAuthClient } from './client/auth-client';

type AuthClient = ReturnType<typeof getAuthClient>;
type SessionPayload = AuthClient['$Infer']['Session'];

export type User = SessionPayload['user'];
export type Session = SessionPayload['session'];
