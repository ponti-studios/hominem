import type { AuthUser as AuthIdentity } from '@ponti-studios/auth/types';

type AuthCredential = 'session' | 'mcp-oauth' | 'mcp-token';
export type AuthUser = AuthIdentity & { isAdmin?: boolean };

export interface AuthContext {
  user: AuthUser;
  userId: string;
  sessionId?: string;
  clientId?: string;
  credential: AuthCredential;
  scopes: string[];
}
