import { createClientEnv } from '@hakumi/env';
import { webSchema } from '@hakumi/env/web';

let cachedEnv: ReturnType<typeof createClientEnv<typeof webSchema>> | null = null;

export function getClientEnv() {
  if (cachedEnv) {
    return cachedEnv;
  }

  cachedEnv = createClientEnv(webSchema, 'notesClient');
  return cachedEnv;
}
