import type { User } from '@hominem/auth/types';

export type AuthCredential = 'session' | 'mcp-oauth' | 'e2e';
export type AuthUser = User & { isAdmin?: boolean };

export interface AuthContext {
  user: AuthUser;
  userId: string;
  sessionId?: string;
  credential: AuthCredential;
  scopes: string[];
}
