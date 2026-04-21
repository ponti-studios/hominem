import type { User } from '@hakumi/auth/types';
import type { Queues } from '@hakumi/services/types';

import type { AuthContextEnvelope } from '../auth/types';

declare module 'hono' {
  interface ContextVariableMap {
    user?: User;
    userId?: string | null;
    auth?: AuthContextEnvelope;
    queues: Queues;
  }
}
