import type { Queues } from '@hominem/services/types';

import type { AuthContextEnvelope } from '../auth/types';
import type { User } from '@hominem/auth/server';

declare module 'hono' {
  interface ContextVariableMap {
    user?: User;
    userId?: string | null;
    auth?: AuthContextEnvelope;
    queues: Queues;
  }
}
