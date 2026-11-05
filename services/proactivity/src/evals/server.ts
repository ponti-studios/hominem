import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';

import { createOpenRouterProactivitySlot } from '../openrouter-slot.js';
import { stateSnapshotSchema } from '../types.js';
import { proactivityEvalCases } from './cases.js';
import { runProactivityEvalCase } from './harness.js';
import { renderDemoPage } from './page.js';

const port = Number(process.env.PROACTIVITY_DEMO_PORT ?? 4177);
const model = process.env.PROACTIVITY_DEMO_MODEL ?? 'openai/gpt-5-mini';
const slot = createOpenRouterProactivitySlot({ model });
const page = renderDemoPage(proactivityEvalCases, model);

const server = createServer(async (request, response) => {
  try {
    if (request.method === 'GET' && (request.url === '/' || request.url === '/index.html')) {
      response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      response.end(page);
      return;
    }

    if (request.method === 'GET' && request.url === '/api/health') {
      sendJson(response, 200, { ok: true, model });
      return;
    }

    if (request.method === 'POST' && request.url === '/api/evaluate') {
      const payload = await readJson(request);
      if (typeof payload !== 'object' || payload === null) {
        sendJson(response, 400, { error: 'Expected a JSON object.' });
        return;
      }
      const caseId = Reflect.get(payload, 'caseId');
      if (typeof caseId !== 'string') {
        sendJson(response, 400, { error: 'caseId must be a string.' });
        return;
      }
      const input = proactivityEvalCases.find((candidate) => candidate.id === caseId);
      if (!input) {
        sendJson(response, 404, { error: `Unknown case "${caseId}".` });
        return;
      }

      let current = input.current;
      const custom = Reflect.get(payload, 'current');
      if (custom !== undefined) {
        const parsed = stateSnapshotSchema.safeParse(custom);
        if (!parsed.success) {
          sendJson(response, 400, {
            error: `Invalid current state: ${parsed.error.issues
              .map((issue) => `${issue.path.join('.') || '<root>'}: ${issue.message}`)
              .join('; ')}`,
          });
          return;
        }
        current = parsed.data;
      }

      const result = await runProactivityEvalCase({ ...input, current }, slot);
      sendJson(response, 200, { result });
      return;
    }

    sendJson(response, 404, { error: 'Not found.' });
  } catch (error) {
    sendJson(response, 500, {
      error: error instanceof Error ? error.message : 'Unexpected demo server error.',
    });
  }
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Proactivity live demo: http://127.0.0.1:${port}`);
  console.log(`Model: ${model}`);
});

function sendJson(response: ServerResponse, status: number, body: unknown) {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(body));
}

async function readJson(request: IncomingMessage): Promise<unknown> {
  let body = '';
  for await (const chunk of request) {
    body += chunk;
    if (body.length > 1_000_000) throw new Error('Request body is too large.');
  }
  return JSON.parse(body || '{}');
}
