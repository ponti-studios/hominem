import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';

import persona from './brain/AGENT.md' with { type: 'text' };
import { auditStream } from './brain/audit_stream.ts';
import { finishRun, logRun } from './log/agent_log.ts';
import { runReflect } from './systems/memory/reflect.ts';

type ChatMode = 'chat' | 'remember' | 'recall' | 'reflect';

async function readStdin(): Promise<string> {
  const chunks: string[] = [];
  for await (const chunk of process.stdin) chunks.push(String(chunk));
  return chunks.join('');
}

function promptFor(mode: ChatMode, request: string, transcript = ''): string {
  if (mode === 'remember') {
    return `Store the fact below as a durable memory in seme. Steps, in order:
1. Call seme_recall with the fact text. If a memory already states the same fact, do NOT save again: reply that it is already stored, with its id and observed date.
2. Otherwise call seme_save with kind 'fact' and content exactly equal to the fact text, verbatim — never paraphrase the user's words.
Then confirm in one line what you stored (or found) and with what type and confidence. Do not delete or correct any memory.

Fact: ${request}`;
  }
  if (mode === 'recall') {
    return `Search your seme memory for the query below, using the seme_recall MCP tool. Report the strongest results with their observed dates, or say plainly that nothing was found.

Query: ${request}`;
  }
  if (mode === 'reflect') {
    return `Extract the durable facts from the conversation below. Emit ONLY JSONL, one fact per line, no prose, no code fences:
{"content": "<the fact as one self-contained sentence — if it quotes the user, quote their words exactly, never paraphrased>", "kind": "<fact|preference|routine|decision|interest|relationship|reference|anti_pattern|observation>"}

Rules, in order:
- Durable only: what the user decided, prefers, or stated about themselves or their world, and what the conversation concluded about their systems. No small talk, no session mechanics, no ephemera.
- Never invent: every fact must be stated in the conversation. Abstain rather than guess.
- If nothing is durable, emit exactly one line: NONE
- Do not call any tools. Do not save anything to seme — the deterministic routine after you does the upsert.

Conversation:
${transcript}`;
  }
  return `Request: ${request}`;
}

async function runPi(prompt: string): Promise<{ reply: string; status: number; events: number[] }> {
  const child = spawn(process.env.PI_CLI ?? 'pi', [
    '--print',
    '--no-session',
    '--mode',
    'json',
    `${persona}\n\n---\n${prompt}`,
  ]);
  let stderr = '';
  child.stderr.setEncoding('utf8');
  child.stderr.on('data', (chunk: string) => {
    stderr += chunk;
  });
  const lines = createInterface({ input: child.stdout, crlfDelay: Infinity });
  const resultPromise = auditStream(lines);
  const statusPromise = new Promise<number>((resolve, reject) => {
    child.once('error', reject);
    child.once('close', (status) => resolve(status ?? 1));
  });
  const [result, status] = await Promise.all([resultPromise, statusPromise]);
  if (stderr) process.stderr.write(stderr);
  return { reply: result.reply, status, events: result.events };
}

export async function chatMain(mode: ChatMode, argv: string[]): Promise<number> {
  let request = argv.join(' ');
  let transcript = '';
  if (mode === 'reflect') {
    transcript = await readStdin();
    if (!transcript.trim()) {
      process.stderr.write('hominem reflect: no conversation on stdin — pipe the transcript in.\n');
      return 2;
    }
    if (!request) request = `transcript, ${transcript.length} chars`;
  }
  if (!request && mode !== 'reflect') {
    process.stderr.write(`hominem ${mode}: missing request\n`);
    return 2;
  }

  const runId = logRun(`agent-${mode}`, {
    status: 'invoked',
    context: { request: request.slice(0, 300) },
  });
  try {
    const result = await runPi(promptFor(mode, request, transcript));
    if (result.status !== 0 || !result.reply.trim()) {
      const message = `pi exited ${result.status}${stderrDescription(result.reply)}`;
      finishRun(runId, { status: 'failed', exitCode: result.status || 1, message });
      return result.status || 1;
    }
    finishRun(runId, {
      status: 'completed',
      exitCode: 0,
      message: `mcp events: ${result.events.join(',') || 'none'}`,
    });
    if (mode !== 'reflect') {
      process.stdout.write(result.reply.endsWith('\n') ? result.reply : `${result.reply}\n`);
      return 0;
    }
    if (result.reply.trim() === 'NONE') {
      process.stdout.write('Nothing durable in that conversation — no facts to upsert.\n');
      return 0;
    }
    return runReflect(result.reply, argv);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    finishRun(runId, { status: 'failed', exitCode: 1, message: message.slice(0, 500) });
    process.stderr.write(`hominem ${mode}: ${message}\n`);
    return 1;
  }
}

function stderrDescription(reply: string): string {
  return reply.trim() ? '' : '; empty reply';
}
