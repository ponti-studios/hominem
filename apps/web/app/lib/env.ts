import { webSchema } from '@hominem/config/web';
import { createClientEnv, createServerEnv } from '@hominem/env';

void createClientEnv(webSchema, 'notesClient');
export const serverEnv = createServerEnv(webSchema, 'notesServer');
