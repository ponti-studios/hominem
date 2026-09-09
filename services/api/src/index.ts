import { logger, LOG_MESSAGES } from '@hominem/telemetry';
import { serve } from '@hono/node-server';
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
ChatGenerationStore.start();

logger.info(LOG_MESSAGES.SERVER_STARTED, { host, port });

serve({
  fetch: app.fetch,
  port,
  hostname: host,
  websocket: { server: websocketServer },
  overrideGlobalObjects: false,
});

initRuntime('api').installSignalHandlers(() => ChatGenerationStore.stop());
