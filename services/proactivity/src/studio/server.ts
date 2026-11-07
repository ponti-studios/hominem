import { createReadStream } from 'node:fs';
import { access, stat } from 'node:fs/promises';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { extname, join, resolve } from 'node:path';

import { createStudioService, StudioError } from './service.js';

const port = Number(process.env.PROACTIVITY_STUDIO_PORT ?? 4177);
const model =
  process.env.PROACTIVITY_STUDIO_MODEL ?? process.env.PROACTIVITY_MODEL ?? 'openai/gpt-5-mini';
const dbPath = process.env.PROACTIVITY_STUDIO_DB ?? resolve(process.cwd(), '.data', 'studio.db');
const studioRoot = resolve(import.meta.dirname, '../../studio');
const production = process.env.NODE_ENV === 'production';

const studio = createStudioService({ dbPath, model });

const vite = production
  ? null
  : await (
      await import('vite')
    ).createServer({
      root: studioRoot,
      server: { middlewareMode: true },
      appType: 'spa',
    });

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url ?? '/', 'http://127.0.0.1');

    if (url.pathname.startsWith('/api/')) {
      await handleApi(request, response, url);
      return;
    }

    if (vite) {
      vite.middlewares(request, response, () => {
        sendJson(response, 404, { error: 'Not found.' });
      });
      return;
    }

    await serveStatic(response, url.pathname);
  } catch (error) {
    const status = error instanceof StudioError ? error.status : 500;
    const message = error instanceof Error ? error.message : 'Unexpected studio error.';
    if (!response.headersSent) {
      sendJson(response, status, {
        error: status === 500 ? 'The check could not be completed.' : message,
        detail: message,
      });
    } else {
      response.end();
    }
  }
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Hominem Today — http://127.0.0.1:${port}`);
  console.log(`Model: ${model}`);
  console.log(`Journal: ${dbPath}`);
  if (!process.env.OPENROUTER_API_KEY) {
    console.warn('OPENROUTER_API_KEY is not set; live checks will fail.');
  }
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    server.close();
    studio.close();
    void vite?.close();
    process.exit(0);
  });
}

async function handleApi(
  request: IncomingMessage,
  response: ServerResponse,
  url: URL,
): Promise<void> {
  if (request.method === 'GET' && url.pathname === '/api/health') {
    sendJson(response, 200, {
      ok: true,
      model,
      modelReady: Boolean(process.env.OPENROUTER_API_KEY),
    });
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/studio') {
    sendJson(response, 200, studio.view());
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/run') {
    const body = await readJson(request);
    const eventId = requireString(body, 'eventId');
    const force = body.force === true;
    await studio.runEvent(eventId, force);
    sendJson(response, 200, studio.view());
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/inject') {
    const body = await readJson(request);
    const presetId = requireString(body, 'presetId');
    const result = await studio.runInjection(presetId);
    sendJson(response, 200, result);
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/preference') {
    const body = await readJson(request);
    const goalId = requireString(body, 'goalId');
    const mode = body.mode === 'mute' ? 'mute' : 'snooze';
    const days = typeof body.days === 'number' ? body.days : mode === 'mute' ? 14 : 3;
    studio.setPreference(goalId, mode, days);
    sendJson(response, 200, studio.view());
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/preference/clear') {
    const body = await readJson(request);
    studio.clearPreference(requireString(body, 'goalId'));
    sendJson(response, 200, studio.view());
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/action') {
    const body = await readJson(request);
    const action = studio.accept(requireString(body, 'resultId'));
    sendJson(response, 200, { action, view: studio.view() });
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/action/status') {
    const body = await readJson(request);
    const status = body.status === 'done' ? 'done' : 'open';
    studio.completeAction(requireString(body, 'id'), status);
    sendJson(response, 200, studio.view());
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/reset') {
    sendJson(response, 200, studio.reset());
    return;
  }

  sendJson(response, 404, { error: 'Not found.' });
}

async function serveStatic(response: ServerResponse, pathname: string): Promise<void> {
  const base = resolve(studioRoot, 'dist');
  const requested = pathname === '/' ? '/index.html' : pathname;
  const candidate = resolve(base, `.${requested}`);
  if (!candidate.startsWith(base)) {
    sendJson(response, 403, { error: 'Forbidden.' });
    return;
  }

  let file = candidate;
  try {
    await access(file);
  } catch {
    file = join(base, 'index.html');
  }

  const info = await stat(file);
  if (!info.isFile()) {
    sendJson(response, 404, { error: 'Not found.' });
    return;
  }

  response.writeHead(200, {
    'content-type': typeFor(file),
    'content-length': info.size,
    'cache-control': file.endsWith('index.html')
      ? 'no-store'
      : 'public, max-age=31536000, immutable',
  });
  createReadStream(file).pipe(response);
}

function typeFor(file: string): string {
  switch (extname(file)) {
    case '.html':
      return 'text/html; charset=utf-8';
    case '.js':
      return 'text/javascript; charset=utf-8';
    case '.css':
      return 'text/css; charset=utf-8';
    case '.svg':
      return 'image/svg+xml';
    case '.woff2':
      return 'font/woff2';
    case '.json':
      return 'application/json; charset=utf-8';
    default:
      return 'application/octet-stream';
  }
}

function sendJson(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(body));
}

async function readJson(request: IncomingMessage): Promise<Record<string, unknown>> {
  let raw = '';
  for await (const chunk of request) {
    raw += chunk;
    if (raw.length > 1_000_000) throw new StudioError(413, 'Request body is too large.');
  }
  const parsed: unknown = JSON.parse(raw || '{}');
  if (!isRecord(parsed)) {
    throw new StudioError(400, 'Expected a JSON object.');
  }
  return parsed;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function requireString(body: Record<string, unknown>, key: string): string {
  const value = body[key];
  if (typeof value !== 'string' || value.length === 0) {
    throw new StudioError(400, `${key} must be a non-empty string.`);
  }
  return value;
}
