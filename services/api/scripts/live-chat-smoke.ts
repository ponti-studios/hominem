/**
 * Sends real chat turns to a running API and checks the model actually uses
 * tools — the failure class unit tests with a scripted provider cannot see
 * (a model that narrates "let me check your tasks" instead of calling one).
 *
 * Usage (API running, signed-in session exported by `pnpm e2e:setup`):
 *   API_URL=http://localhost:4040 E2E_SESSION_COOKIE=... pnpm --filter @hominem/api live-chat-smoke
 *
 * SMOKE_CASES=add-task,plain-chat limits the run (default: every case). Asserts
 * on tool calls and resulting state, never on wording, because a live model's
 * text varies. Each case gets SMOKE_ATTEMPTS tries (default 2) to absorb
 * ordinary sampling variance; a case that fails every attempt fails the run.
 */

import { randomUUID } from 'node:crypto';
import { appendFileSync } from 'node:fs';

import z from 'zod';

const API_URL = (process.env.API_URL ?? 'http://localhost:4040').replace(/\/$/, '');
const COOKIE = process.env.E2E_SESSION_COOKIE;
const ATTEMPTS = Number(process.env.SMOKE_ATTEMPTS ?? 2);
const TURN_TIMEOUT_MS = 90_000;

if (!COOKIE) {
  console.error('E2E_SESSION_COOKIE is required (run `pnpm e2e:setup` and export its output).');
  process.exit(1);
}

const eventSchema = z.object({ type: z.string(), payload: z.unknown() });
const toolRequestedSchema = z.object({ call: z.object({ name: z.string() }) });
const toolCompletedSchema = z.object({
  result: z.object({ toolName: z.string(), error: z.boolean().optional() }),
});
const textDeltaSchema = z.object({ text: z.string() });
const taskListSchema = z.object({
  tasks: z.array(z.object({ id: z.string(), title: z.string() })),
});

type Turn = {
  requested: string[];
  completed: { name: string; error: boolean }[];
  text: string;
  failed: boolean;
};

async function api(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${API_URL}${path}`, {
    signal: AbortSignal.timeout(30_000),
    ...init,
    headers: {
      'content-type': 'application/json',
      cookie: COOKIE ?? '',
      origin: API_URL,
      ...init.headers,
    },
  });
}

async function runTurn(message: string): Promise<Turn> {
  const response = await api('/api/chats/start-stream', {
    method: 'POST',
    body: JSON.stringify({ generationId: randomUUID(), title: 'live-chat-smoke', message }),
    signal: AbortSignal.timeout(TURN_TIMEOUT_MS),
  });
  if (!response.ok || !response.body) {
    throw new Error(`start-stream failed: HTTP ${response.status} ${await response.text()}`);
  }

  const turn: Turn = { requested: [], completed: [], text: '', failed: false };
  const decoder = new TextDecoder();
  let buffer = '';
  for await (const chunk of response.body) {
    buffer += decoder.decode(chunk, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      if (!line.startsWith('data: ') || line === 'data: [DONE]') continue;
      const event = eventSchema.safeParse(JSON.parse(line.slice('data: '.length)));
      if (!event.success) continue;
      const { type, payload } = event.data;
      if (type === 'tool.requested') {
        const parsed = toolRequestedSchema.safeParse(payload);
        if (parsed.success) turn.requested.push(parsed.data.call.name);
      } else if (type === 'tool.completed') {
        const parsed = toolCompletedSchema.safeParse(payload);
        if (parsed.success) {
          turn.completed.push({
            name: parsed.data.result.toolName,
            error: parsed.data.result.error ?? false,
          });
        }
      } else if (type === 'text-delta') {
        const parsed = textDeltaSchema.safeParse(payload);
        if (parsed.success) turn.text += parsed.data.text;
      } else if (type === 'generation.failed') {
        turn.failed = true;
      }
    }
  }
  return turn;
}

async function listTasks() {
  const response = await api('/api/tasks');
  if (!response.ok) throw new Error(`GET /api/tasks failed: HTTP ${response.status}`);
  return taskListSchema.parse(await response.json()).tasks;
}

async function deleteTasksMatching(pattern: RegExp) {
  for (const task of await listTasks()) {
    if (pattern.test(task.title)) await api(`/api/tasks/${task.id}`, { method: 'DELETE' });
  }
}

const GOOGLE_HOME = /google home/i;

type SmokeCase = {
  name: string;
  message: string;
  before?: () => Promise<void>;
  after?: () => Promise<void>;
  // Returns a failure reason, or null when the turn behaved correctly.
  check: (turn: Turn) => Promise<string | null> | string | null;
};

const cases: SmokeCase[] = [
  {
    // The exact request that once got "let me check your tasks" and no tool call.
    name: 'add-task',
    message: 'add a task to setup google home for my new living room lights',
    before: () => deleteTasksMatching(GOOGLE_HOME),
    after: () => deleteTasksMatching(GOOGLE_HOME),
    check: async (turn) => {
      if (turn.failed) return 'generation failed';
      if (!turn.completed.some((call) => call.name === 'task_create' && !call.error)) {
        return `task_create never completed (requested: ${turn.requested.join(', ') || 'none'})`;
      }
      const created = (await listTasks()).some((task) => GOOGLE_HOME.test(task.title));
      return created ? null : 'task_create completed but no matching task exists';
    },
  },
  {
    name: 'list-tasks',
    message: 'what tasks do I have right now?',
    check: (turn) =>
      turn.completed.some((call) => call.name === 'task_list' && !call.error)
        ? null
        : `task_list never completed (requested: ${turn.requested.join(', ') || 'none'})`,
  },
  {
    // Control: tools are exposed on every turn, so make sure they are not used needlessly.
    name: 'plain-chat',
    message: 'Reply with exactly one word: hello',
    check: (turn) => {
      if (turn.failed) return 'generation failed';
      if (turn.requested.length > 0) return `unexpected tool calls: ${turn.requested.join(', ')}`;
      return turn.text.trim() ? null : 'empty reply';
    },
  },
];

async function runCase(smokeCase: SmokeCase): Promise<string | null> {
  let reason: string | null = 'not run';
  for (let attempt = 1; attempt <= ATTEMPTS && reason !== null; attempt++) {
    try {
      await smokeCase.before?.();
      reason = await smokeCase.check(await runTurn(smokeCase.message));
    } catch (error) {
      reason = error instanceof Error ? error.message : String(error);
    } finally {
      await smokeCase.after?.().catch(() => undefined);
    }
    if (reason !== null) console.log(`  attempt ${attempt}/${ATTEMPTS} failed: ${reason}`);
  }
  return reason;
}

// An unset or empty SMOKE_CASES (the workflow passes "" when the input is blank) means all.
const selected = (process.env.SMOKE_CASES ?? '')
  .split(',')
  .map((name) => name.trim())
  .filter(Boolean);
const toRun =
  selected.length > 0 ? cases.filter((smokeCase) => selected.includes(smokeCase.name)) : cases;
if (toRun.length === 0) {
  console.error(`No cases match SMOKE_CASES=${process.env.SMOKE_CASES}`);
  process.exit(1);
}

const rows: string[] = [];
let failures = 0;
for (const smokeCase of toRun) {
  console.log(`▶ ${smokeCase.name}: ${smokeCase.message}`);
  const reason = await runCase(smokeCase);
  console.log(reason === null ? '  ✓ passed' : `  ✗ failed: ${reason}`);
  rows.push(`| ${smokeCase.name} | ${reason === null ? 'pass' : 'FAIL (see job log)'} |`);
  if (reason !== null) failures++;
}

if (process.env.GITHUB_STEP_SUMMARY) {
  appendFileSync(
    process.env.GITHUB_STEP_SUMMARY,
    `## Live chat smoke\n\n| case | result |\n| --- | --- |\n${rows.join('\n')}\n`,
  );
}
process.exit(failures === 0 ? 0 : 1);
