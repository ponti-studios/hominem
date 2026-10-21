import type { AuthContext } from '../auth/types';

declare module 'hono' {
  interface ContextVariableMap {
    auth?: AuthContext;
  }
}
