import type { User } from '@hominem/auth/types';
import type { Queue } from 'bullmq';

import type { AuthContextEnvelope } from '../auth/types';

declare module 'hono' {
  interface ContextVariableMap {
    user?: User;
    userId?: string | null;
    auth?: AuthContextEnvelope;
    queues: {
      importTransactions: Queue;
      placePhotoEnrich: Queue;
    };
  }
}
