import { logger, LOG_MESSAGES } from '@hominem/telemetry';
import { serve } from '@hono/node-server';

import { env } from './env';
import { attachChatRealtimeWebSocketServer } from './rpc/realtime/chat-ws';
import { initRuntime } from './runtime';
import { createServer } from './server';

const app = createServer();
const port = Number.parseInt(env.PORT, 10);
const host = '0.0.0.0';

logger.info(LOG_MESSAGES.SERVER_STARTED, { host, port });

const nodeServer = serve({
  fetch: app.fetch,
  port,
  hostname: host,
  overrideGlobalObjects: false,
});

const detachChatRealtimeWebSocket = attachChatRealtimeWebSocketServer(nodeServer);

initRuntime('hominem-api').installSignalHandlers([detachChatRealtimeWebSocket]);
