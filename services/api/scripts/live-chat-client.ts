/**
 * Shared client for the live chat scripts (`live-chat-smoke`, `live-chat-flows`): sends
 * real chat turns to a running API, answers confirmation prompts, and reads or cleans
 * up the data those turns created.
 *
 * Needs `API_URL` and `E2E_SESSION_COOKIE` (see `pnpm e2e:setup`). It refuses any API
 * that is not local, because the scripts delete data belonging to the test account.
 */

import { randomUUID } from 'node:crypto';
import { appendFileSync } from 'node:fs';

import z from 'zod';

const API_URL = (process.env.API_URL ?? 'http://localhost:4040').replace(/\/$/, '');
const COOKIE = process.env.E2E_SESSION_COOKIE;
const TURN_TIMEOUT_MS = 90_000;

if (!['localhost', '127.0.0.1', 'api.lvh.me'].includes(new URL(API_URL).hostname)) {
  console.error(`Refusing to run against ${API_URL}: these scripts delete test-account data.`);
  process.exit(1);
}
if (!COOKIE) {
  console.error('E2E_SESSION_COOKIE is required (run `pnpm e2e:setup` and export its output).');
  process.exit(1);
}

const eventSchema = z.object({ type: z.string(), payload: z.unknown() });
const acceptedSchema = z.object({ chatId: z.string() });
const startedSchema = z.object({
  context: z.object({ chatId: z.string(), targetAssistantMessageId: z.string().nullable() }),
});
const toolRequestedSchema = z.object({
  call: z.object({ name: z.string(), arguments: z.string().optional() }),
});
// The assistant message a call belongs to is not known when a new chat starts; it arrives on
// the checkpoint and on the durable copy of the confirmation event.
const confirmationRequiredSchema = z.object({
  call: z.object({ id: z.string(), name: z.string(), messageId: z.string().optional() }),
});
const checkpointedSchema = z.object({
  checkpoint: z.object({ assistantMessage: z.object({ id: z.string() }) }),
});
const toolResultSchema = z.object({
  result: z.object({
    toolName: z.string(),
    error: z.boolean().optional(),
    content: z.string().optional(),
  }),
});
const textDeltaSchema = z.object({ text: z.string() });

export type Turn = {
  chatId: string | null;
  // The assistant message a pending confirmation belongs to.
  assistantMessageId: string | null;
  // Arguments the model sent, and what each tool answered, in call order.
  calls: { name: string; arguments: string }[];
  completed: { name: string; error: boolean; content: string }[];
  text: string;
  failed: boolean;
  // A tool call waiting for the user to approve or reject it.
  pending: { toolCallId: string; toolName: string } | null;
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

async function readTurn(response: Response, previous?: Turn): Promise<Turn> {
  if (!response.ok || !response.body) {
    throw new Error(`chat request failed: HTTP ${response.status} ${await response.text()}`);
  }
  const turn: Turn = {
    chatId: previous?.chatId ?? null,
    assistantMessageId: previous?.assistantMessageId ?? null,
    calls: [],
    completed: [],
    text: '',
    failed: false,
    pending: null,
  };
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
      if (type === 'generation.accepted') {
        const parsed = acceptedSchema.safeParse(payload);
        if (parsed.success) turn.chatId = parsed.data.chatId;
      } else if (type === 'generation.started') {
        const parsed = startedSchema.safeParse(payload);
        if (parsed.success) {
          turn.chatId = parsed.data.context.chatId;
          turn.assistantMessageId =
            parsed.data.context.targetAssistantMessageId ?? turn.assistantMessageId;
        }
      } else if (type === 'tool.requested') {
        const parsed = toolRequestedSchema.safeParse(payload);
        if (parsed.success) {
          turn.calls.push({
            name: parsed.data.call.name,
            arguments: parsed.data.call.arguments ?? '',
          });
        }
      } else if (type === 'tool.completed' || type === 'tool.failed') {
        const parsed = toolResultSchema.safeParse(payload);
        if (parsed.success) {
          turn.completed.push({
            name: parsed.data.result.toolName,
            error: parsed.data.result.error ?? false,
            content: parsed.data.result.content ?? '',
          });
        }
      } else if (type === 'confirmation.required') {
        const parsed = confirmationRequiredSchema.safeParse(payload);
        if (parsed.success) {
          turn.pending = { toolCallId: parsed.data.call.id, toolName: parsed.data.call.name };
          turn.assistantMessageId = parsed.data.call.messageId ?? turn.assistantMessageId;
        }
      } else if (type === 'generation.checkpointed') {
        const parsed = checkpointedSchema.safeParse(payload);
        if (parsed.success) turn.assistantMessageId = parsed.data.checkpoint.assistantMessage.id;
      } else if (type === 'confirmation.approved' || type === 'confirmation.rejected') {
        turn.pending = null;
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

/** Sends one user message: a new chat when `chatId` is null, else a follow-up in that chat. */
export async function runTurn(message: string, chatId: string | null = null): Promise<Turn> {
  const response = chatId
    ? await api(`/api/chats/${chatId}/stream`, {
        method: 'POST',
        body: JSON.stringify({ generationId: randomUUID(), message, fileIds: [] }),
        signal: AbortSignal.timeout(TURN_TIMEOUT_MS),
      })
    : await api('/api/chats/start-stream', {
        method: 'POST',
        body: JSON.stringify({ generationId: randomUUID(), title: 'live-chat', message }),
        signal: AbortSignal.timeout(TURN_TIMEOUT_MS),
      });
  const turn = await readTurn(response);
  return chatId ? { ...turn, chatId } : turn;
}

/** Approves or rejects the tool call a turn is waiting on, and returns what happened next. */
export async function respondToConfirmation(turn: Turn, approved: boolean): Promise<Turn> {
  if (!turn.pending || !turn.chatId || !turn.assistantMessageId) {
    throw new Error('no pending confirmation to respond to');
  }
  const response = await api(
    `/api/chats/${turn.chatId}/messages/${turn.assistantMessageId}/tool-calls/${turn.pending.toolCallId}/respond`,
    {
      method: 'POST',
      body: JSON.stringify({ approved }),
      signal: AbortSignal.timeout(TURN_TIMEOUT_MS),
    },
  );
  return readTurn(response, turn);
}

/** Joins two turns of one conversation step (for example a question and its answer). */
export function mergeTurns(first: Turn, second: Turn): Turn {
  return {
    chatId: second.chatId ?? first.chatId,
    assistantMessageId: second.assistantMessageId ?? first.assistantMessageId,
    calls: [...first.calls, ...second.calls],
    completed: [...first.completed, ...second.completed],
    text: second.text || first.text,
    failed: first.failed || second.failed,
    pending: second.pending,
  };
}

export const clip = (text: string, max: number) =>
  text.length > max ? `${text.slice(0, max)}…` : text;

/** "<tool> never completed (requested: …)" with whatever the failed calls said. */
export function describeMissingCall(turn: Turn, tool: string): string {
  const requested = turn.calls.map((call) => call.name).join(', ') || 'none';
  return `${tool} never completed (requested: ${requested})${describeFailedCalls(turn)}`;
}

/** Cases named in the comma-separated env var, or all of them when it is unset or blank. */
export function selectCases<T extends { name: string }>(envName: string, all: readonly T[]): T[] {
  const names = (process.env[envName] ?? '')
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean);
  const selected = names.length > 0 ? all.filter((item) => names.includes(item.name)) : [...all];
  if (selected.length === 0) {
    console.error(`No cases match ${envName}=${process.env[envName]}`);
    process.exit(1);
  }
  return selected;
}

/** Appends a section to the GitHub job summary; only static pass/fail text belongs here. */
export function appendJobSummary(markdown: string): void {
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, markdown);
}

// What the model sent and what each failed tool answered, for the job log.
export function describeFailedCalls(turn: Turn): string {
  const failed = turn.completed
    .map((result, index) => ({ result, call: turn.calls[index] }))
    .filter(({ result }) => result.error);
  return failed.length === 0
    ? ''
    : ` | failed calls: ${failed
        .map(
          ({ result, call }) =>
            `${result.name}(${clip(call?.arguments ?? '?', 300)}) -> ${clip(result.content, 300)}`,
        )
        .join(' ; ')}`;
}

// ── data the turns create ──────────────────────────────────────────────────

const taskSchema = z.object({
  id: z.string(),
  title: z.string(),
  status: z.string().optional(),
  priority: z.string().optional(),
  dueAt: z.string().nullable().optional(),
});
type TaskRow = z.infer<typeof taskSchema>;

export async function listTasks(): Promise<TaskRow[]> {
  const response = await api('/api/tasks');
  if (!response.ok) throw new Error(`GET /api/tasks failed: HTTP ${response.status}`);
  return z.object({ tasks: z.array(taskSchema) }).parse(await response.json()).tasks;
}

export async function createTask(title: string): Promise<void> {
  const response = await api('/api/tasks', {
    method: 'POST',
    body: JSON.stringify({ title, artifactType: 'task' }),
  });
  if (!response.ok) throw new Error(`POST /api/tasks failed: HTTP ${response.status}`);
}

// Cleanup that silently failed would leave stale records and corrupt later assertions, so a
// failed delete throws. A 404 means the record is already gone.
async function deleteRecord(path: string): Promise<void> {
  const response = await api(path, { method: 'DELETE' });
  if (!response.ok && response.status !== 404) {
    throw new Error(`DELETE ${path} failed: HTTP ${response.status}`);
  }
}

export async function deleteTask(id: string): Promise<void> {
  await deleteRecord(`/api/tasks/${id}`);
}

export async function listMemories(): Promise<{ id: string; content: string }[]> {
  const response = await api('/api/memory');
  if (!response.ok) throw new Error(`GET /api/memory failed: HTTP ${response.status}`);
  return z
    .object({ memories: z.array(z.object({ id: z.string(), content: z.string() })) })
    .parse(await response.json()).memories;
}

export async function deleteMemory(id: string): Promise<void> {
  await deleteRecord(`/api/memory/${id}`);
}

export async function getNote(
  id: string,
): Promise<{ title: string | null; content: string } | null> {
  const response = await api(`/api/notes/${id}`);
  if (!response.ok) return null;
  return z
    .object({ title: z.string().nullable(), content: z.string() })
    .parse(await response.json());
}

export async function deleteNote(id: string): Promise<void> {
  await deleteRecord(`/api/notes/${id}`);
}

/** Ids of records a tool created, read from its `{ <key>: { id } }` result. */
export function createdIds(turn: Turn, toolName: string, key: string): string[] {
  const shape = z.object({ [key]: z.object({ id: z.string() }) });
  return turn.completed
    .filter((result) => result.name === toolName && !result.error)
    .flatMap((result) => {
      try {
        const parsed = shape.safeParse(JSON.parse(result.content));
        return parsed.success ? [parsed.data[key].id] : [];
      } catch {
        return [];
      }
    });
}
