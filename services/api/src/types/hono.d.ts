import type { User } from '@hominem/auth/types';
import type { Queues } from '@hominem/services/types';

import type { AuthContextEnvelope } from '../auth/types';

declare module 'hono' {
  interface ContextVariableMap {
    user?: User;
    userId?: string | null;
    auth?: AuthContextEnvelope;
    queues: Queues;
  }
}
