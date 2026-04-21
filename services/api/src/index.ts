import { logger } from '@hominem/telemetry';
import { serve } from '@hono/node-server';

import { env } from './env';
import { initRuntime } from './runtime';
import { createServer } from './server';

const app = createServer();
initRuntime('hominem-api').installSignalHandlers();
const port = Number.parseInt(env.PORT, 10);
const host = '0.0.0.0';

logger.info('server_started', { host, port });

serve({
  fetch: app.fetch,
  port,
  hostname: host,
  overrideGlobalObjects: false,
});
