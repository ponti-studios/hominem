import { createServerEnv } from '@hakumi/env';
import { webSchema } from '@hakumi/env/web';

export const serverEnv = createServerEnv(webSchema, 'notesServer');