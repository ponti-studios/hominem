import { createClientEnv, createServerEnv } from '@hominem/env';
import { webSchema } from '@hominem/env/web';

void createClientEnv(webSchema, 'notesClient');
export const serverEnv = createServerEnv(webSchema, 'notesServer');
