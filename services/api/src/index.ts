import {
  createServer as createNodeServer,
  type IncomingMessage,
  type RequestListener,
  type Server,
  type ServerOptions,
  type ServerResponse,
} from 'node:http';

import { logger, LOG_MESSAGES } from '@hominem/telemetry';
import { createAdaptorServer, serve } from '@hono/node-server';
import { WebSocketServer } from 'ws';

import { ChatGenerationStore } from './chat/chat-generation-store';
import { env } from './env';
import { resolveAiProvider, resolveEmailProvider } from './provider-mode';
import { initRuntime } from './runtime';
import { createServer } from './server';

const aiProvider = resolveAiProvider(env);
if (aiProvider === 'scripted' && env.NODE_ENV === 'production') {
  throw new Error('Scripted providers are not allowed in production');
}

// Production always sends real email while other environments capture to the
// scripted mailbox. ENV=scripted forces scripted AI and email together.
const emailProvider = resolveEmailProvider(env);
if (emailProvider === 'scripted' && env.NODE_ENV === 'production') {
  throw new Error('Scripted providers are not allowed in production');
}

logger.info(LOG_MESSAGES.EMAIL_PROVIDER, {
  provider: emailProvider,
  source: env.ENV === 'scripted' ? 'scripted-mode' : 'inferred',
});

// One dispatcher owns every scripted external provider (see
// testkit/scripted-providers.ts for why this must be a single install site
// rather than one per provider).
if (aiProvider === 'scripted' || emailProvider === 'scripted') {
  const { installScriptedProviders } = await import('./testkit/scripted-providers');
  const { resolveScriptedMailboxPath } = await import('@hominem/utils/email');
  installScriptedProviders({
    ai: aiProvider === 'scripted',
    email: emailProvider === 'scripted',
    mailboxFile: resolveScriptedMailboxPath(env.HOMINEM_SCRIPTED_MAILBOX),
  });
}

const app = createServer();
const port = env.PORT ?? 4040;
const host = '0.0.0.0';
const websocketServer = new WebSocketServer({ noServer: true });

async function startServer() {
  ChatGenerationStore.start();
  logger.info(LOG_MESSAGES.SERVER_STARTED, { host, port });

  if (env.NODE_ENV !== 'development') {
    serve({
      fetch: app.fetch,
      port,
      hostname: host,
      websocket: { server: websocketServer },
      overrideGlobalObjects: false,
    });
    return;
  }

  let vite: import('vite').ViteDevServer | undefined;
  function createViteAwareServer<
    Request extends typeof IncomingMessage = typeof IncomingMessage,
    Response extends typeof ServerResponse<InstanceType<Request>> = typeof ServerResponse,
  >(requestListener?: RequestListener<Request, Response>): Server<Request, Response>;
  function createViteAwareServer<
    Request extends typeof IncomingMessage = typeof IncomingMessage,
    Response extends typeof ServerResponse<InstanceType<Request>> = typeof ServerResponse,
  >(
    options: ServerOptions<Request, Response>,
    requestListener?: RequestListener<Request, Response>,
  ): Server<Request, Response>;
  function createViteAwareServer(
    optionsOrListener?: ServerOptions | RequestListener,
    listener?: RequestListener,
  ) {
    const options = typeof optionsOrListener === 'function' ? undefined : optionsOrListener;
    const requestListener = typeof optionsOrListener === 'function' ? optionsOrListener : listener;
    const viteAwareListener: RequestListener = (request, response) => {
      if (!vite) {
        response.statusCode = 503;
        response.end('Vite is starting');
        return;
      }
      vite.middlewares(request, response, () => {
        Promise.resolve(requestListener?.(request, response)).catch((error: unknown) => {
          response.destroy(error instanceof Error ? error : new Error(String(error)));
        });
      });
    };
    return options
      ? createNodeServer(options, viteAwareListener)
      : createNodeServer(viteAwareListener);
  }
  const apiServer = createAdaptorServer({
    createServer: createViteAwareServer,
    fetch: app.fetch,
    hostname: host,
    overrideGlobalObjects: false,
    websocket: { server: websocketServer },
  });

  const viteModule = 'vite';
  const { createServer: createViteServer } = await import(viteModule);
  vite = await createViteServer({
    appType: 'custom',
    server: {
      hmr: { server: apiServer },
      middlewareMode: { server: apiServer },
    },
  });
  apiServer.listen(port, host);
}

await startServer();
initRuntime('api').installSignalHandlers(() => ChatGenerationStore.stop());
