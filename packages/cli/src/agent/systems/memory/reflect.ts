#!/usr/bin/env node
/**
 * memory-reflect — the conversation-end memory routine (plans item 3,
 * ROADMAP P4). It replaces the memory-mirror's sync with the seme-native
 * path: no manifest, no Drive round-trip — seme itself is the state anchor
 * (recall plus the recent window).
 *
 * Input: JSONL on stdin, one durable fact per line:
 *   {"content": "...", "kind": "fact", "session_id": "optional"}
 *
 * For each fact, through the seme MCP server (SEME_MCP_CMD from env — the
 * same server her brain uses, so a fact saved here reads back from any of
 * her sessions). The dedup gate has TWO anchors, because one proved too
 * narrow live (the 2026-11-22 re-run proof): a fact the model reworded on
 * a second pass scored dice 0.714 against its stored copy, but
 * seme_recall's top-N never returned that copy, so a duplicate was saved.
 * Every fact is compared against:
 *   1. semantic neighbors — seme_recall queried with the fact text; and
 *   2. the recent window — one seme_list_memories call per run (the
 *      newest RECENT_WINDOW active memories, where conversation-end dupes
 *      live) plus everything saved earlier in this same run.
 * exact match  -> already stored; nothing written (idempotent, law 3).
 * close variant -> CONFLICT: seme's copy is kept and the conflict
 *                 reported. Never silently overwritten.
 * no match     -> seme_save with the content verbatim (law 2: Charles's
 *                 words are never paraphrased), then a read-back recall
 *                 proves it retrievable.
 *
 * Doctrine, carried over from the memory-mirror (README-SYNC.md, archived
 * 2026-11-21) and restated for seme:
 *   - Charlie's edits are authoritative corrections. What seme already
 *     holds is never corrected or forgotten by this routine — seme_correct
 *     and seme_forget are named, confirmed operations and have no path
 *     here.
 *   - Conflicts are flagged, never silently overwritten. A close variant
 *     of a stored memory is reported with both wordings and left for
 *     Charles to resolve.
 *   - Never delete on disappearance: nothing is forgotten, ever, here.
 *
 * Audit (law 1): one `events` row per MCP call (connector "seme", service
 * "mcp" — same convention as brain/audit_stream.ts), one `runs` row for
 * the routine (source "memory-reflect").
 *
 * Exit codes: 0 clean; 1 any conflict, failed or unverified fact (the
 * mirror's semantics: findings need eyes); 2 usage/config error, before
 * any row is written.
 */
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { createInterface } from 'node:readline';

import { finishRun, logEvent, logRun } from '../../log/agent_log.ts';

/** seme's own memory kinds (from the seme MCP tool schema — never guessed). */
const KINDS = new Set([
  'fact',
  'preference',
  'routine',
  'decision',
  'interest',
  'relationship',
  'reference',
  'anti_pattern',
  'observation',
]);

/**
 * Dice coefficient at or above this counts as a close variant -> conflict.
 * The proof's paraphrase pair ("Hominem is my name; I am Charles's personal
 * engine replacing Meta Muse" vs "Hominem is the name of Charles's personal
 * engine; Hominem replaces Meta Muse...") scores 0.56; unrelated facts score
 * near 0. When in doubt, flag — never write over the doubt.
 */
const NEAR_DICE = 0.5;
/**
 * The recent window: newest-first active memories pulled once per run via
 * seme_list_memories (the server orders by recorded_at DESC). Conversation-
 * end duplicates are recent by definition — this is the state anchor that
 * bounds the gate when recall's ranking misses them.
 */
const RECENT_WINDOW = 200;
const CALL_TIMEOUT_MS = 30_000;

interface Fact {
  content: string;
  kind: string;
  sessionId: string | undefined;
}

/** What seme_recall returns per memory (retrieval.ts field set). */
interface SemeMemory {
  id: string;
  kind: string;
  value_text: string;
  confidence: number;
  observed_at: string;
}

interface McpCallResult {
  ok: boolean;
  /** Parsed tool result when ok; raw text otherwise. */
  result: unknown;
  error: { error: unknown; message: string } | null;
}

type Outcome =
  | { status: 'saved'; turnId: string; verified: boolean; note?: string }
  | { status: 'would-save' }
  | { status: 'already'; memory: SemeMemory }
  | { status: 'conflict'; kept: SemeMemory }
  | { status: 'failed'; message: string };

// ------------------------------------------------------------- comparison

/** Lowercase, punctuation stripped, whitespace collapsed. */
function normalizeText(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenSet(s: string): Set<string> {
  return new Set(normalizeText(s).split(' ').filter(Boolean));
}

/** Dice coefficient over token sets: 2|A∩B| / (|A|+|B|). */
function dice(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  return (2 * inter) / (a.size + b.size);
}

/**
 * Strip FTS5 operators from the recall query (seme doctrine). Only the
 * search string is touched — what gets saved stays verbatim.
 */
function sanitizeQuery(s: string): string {
  return s
    .replace(/[?*"()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function slice(s: string, n = 60): string {
  return s.length > n ? `${s.slice(0, n)}…` : s;
}

// ------------------------------------------------------------- MCP client

interface JsonRpcResponse {
  jsonrpc: string;
  id?: number | null;
  result?: unknown;
  error?: { code: number; message: string };
}

interface PendingCall {
  resolve: (r: JsonRpcResponse) => void;
  reject: (e: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

/** Newline-delimited JSON-RPC client over the seme MCP server's stdio. */
class SemeMcp {
  private proc: ChildProcessWithoutNullStreams;
  private nextId = 1;
  private pending = new Map<number, PendingCall>();
  private dead: string | null = null;

  constructor(command: string) {
    const parts = command.trim().split(/\s+/);
    if (parts.length === 0 || !parts[0]) {
      throw new Error(
        'SEME_MCP_CMD is empty — give the full command, e.g. "node /path/to/mcp-server.js"',
      );
    }
    this.proc = spawn(parts[0]!, parts.slice(1), { stdio: ['pipe', 'pipe', 'pipe'] });
    this.proc.stderr.on('data', (d) => process.stderr.write(d)); // faithful passthrough
    this.proc.stdin.on('error', () => {}); // EPIPE after death is surfaced via exit/error, not a crash
    this.proc.on('error', (e) => {
      this.dead = `seme MCP server failed to start: ${e.message}`;
      for (const [, p] of this.pending) {
        clearTimeout(p.timer);
        p.reject(new Error(this.dead));
      }
      this.pending.clear();
    });
    this.proc.on('exit', (code) => {
      this.dead = `seme MCP server exited (code ${code ?? 'signal'})`;
      for (const [, p] of this.pending) {
        clearTimeout(p.timer);
        p.reject(new Error(`${this.dead} while a call was in flight`));
      }
      this.pending.clear();
    });
    const rl = createInterface({ input: this.proc.stdout, crlfDelay: Infinity });
    rl.on('line', (line) => {
      if (!line.trim()) return;
      let msg: JsonRpcResponse;
      try {
        msg = JSON.parse(line) as JsonRpcResponse;
      } catch {
        process.stderr.write(`reflect: non-JSON line from seme server: ${slice(line, 120)}\n`);
        return;
      }
      if (typeof msg.id === 'number') {
        const p = this.pending.get(msg.id);
        if (p) {
          this.pending.delete(msg.id);
          clearTimeout(p.timer);
          p.resolve(msg);
        }
      }
    });
  }

  /** MCP handshake: initialize + initialized notification. */
  async initialize(): Promise<void> {
    await this.request('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'hominem-memory-reflect', version: '1.0.0' },
    });
    this.proc.stdin.write(
      `${JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' })}\n`,
    );
  }

  private request(method: string, params: unknown): Promise<JsonRpcResponse> {
    if (this.dead) return Promise.reject(new Error(this.dead));
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`seme MCP call timed out after ${CALL_TIMEOUT_MS}ms (${method})`));
      }, CALL_TIMEOUT_MS);
      this.pending.set(id, { resolve, reject, timer });
      this.proc.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`);
    });
  }

  /** One MCP tool call, resolved to the seme-shaped result or a named error. */
  async call(tool: string, args: Record<string, unknown>): Promise<McpCallResult> {
    let msg: JsonRpcResponse;
    try {
      msg = await this.request('tools/call', { name: tool, arguments: args });
    } catch (e) {
      return {
        ok: false,
        result: null,
        error: { error: 'mcp_call_failed', message: (e as Error).message },
      };
    }
    if (msg.error) {
      return {
        ok: false,
        result: null,
        error: { error: msg.error.code, message: msg.error.message },
      };
    }
    const result = msg.result as
      | { content?: Array<{ type: string; text?: string }>; isError?: boolean }
      | undefined;
    const text = (result?.content ?? [])
      .filter((c) => c.type === 'text')
      .map((c) => c.text ?? '')
      .join('');
    if (result?.isError === true) {
      return {
        ok: false,
        result: result.content ?? null,
        error: { error: 'mcp_tool_error', message: slice(text, 500) },
      };
    }
    try {
      return { ok: true, result: JSON.parse(text), error: null };
    } catch {
      return { ok: true, result: text, error: null };
    }
  }

  close(): void {
    this.proc.stdin.end();
  }
}

// ---------------------------------------------------------------- auditing

/** One MCP call -> one events row, matching brain/audit_stream.ts's shape. */
async function auditedCall(
  mcp: SemeMcp,
  tool: string,
  args: Record<string, unknown>,
): Promise<{
  call: McpCallResult;
  eventId: number;
}> {
  const tReq = Date.now();
  const call = await mcp.call(tool, args);
  const tRes = Date.now();
  const eventId = logEvent('seme', [tool], {
    tsRequest: new Date(tReq).toISOString(),
    tsRequestMs: tReq,
    tsResponse: new Date(tRes).toISOString(),
    tsResponseMs: tRes,
    durationMs: tRes - tReq,
    service: 'mcp',
    params: args,
    response: call.ok ? call.result : call.result,
    ok: call.ok,
    isError: !call.ok,
    error: call.error
      ? { error: call.error.error, message: call.error.message, requestId: null }
      : null,
  });
  return { call, eventId };
}

function parseMemories(call: McpCallResult): SemeMemory[] {
  if (!call.ok) return [];
  const r = call.result as { memories?: unknown } | null;
  if (!r || typeof r !== 'object' || !Array.isArray(r.memories)) return [];
  return (r.memories as Array<Record<string, unknown>>).flatMap((m) => {
    const id = typeof m['id'] === 'string' ? m['id'] : null;
    const value = typeof m['value_text'] === 'string' ? m['value_text'] : null;
    if (id === null || value === null) return [];
    return [
      {
        id,
        kind: typeof m['kind'] === 'string' ? m['kind'] : '',
        value_text: value,
        confidence: typeof m['confidence'] === 'number' ? m['confidence'] : 0,
        observed_at: typeof m['observed_at'] === 'string' ? m['observed_at'] : '',
      },
    ];
  });
}

// ------------------------------------------------------------ fact routine

/** A saved-this-run fact as a dedup candidate (the turn id stands in for the memory id). */
function thisRun(fact: Fact, tag: string): SemeMemory {
  return {
    id: `this-run:${tag}`,
    kind: fact.kind,
    value_text: fact.content,
    confidence: 1,
    observed_at: new Date().toISOString(),
  };
}

/**
 * Recall-first upsert for one fact. Doctrine lives in the branch names.
 * `prior` is the running dedup window — the recent list plus everything
 * saved earlier this run; the routine pushes into it as it goes.
 */
async function processFact(
  mcp: SemeMcp,
  fact: Fact,
  dryRun: boolean,
  prior: SemeMemory[],
): Promise<{ outcome: Outcome; eventIds: number[] }> {
  const eventIds: number[] = [];
  const recallArgs = { query: sanitizeQuery(fact.content), session_id: fact.sessionId };

  const recall = await auditedCall(mcp, 'seme_recall', recallArgs);
  eventIds.push(recall.eventId);
  if (!recall.call.ok) {
    return {
      outcome: {
        status: 'failed',
        message: `seme_recall: ${recall.call.error?.message ?? 'failed'}`,
      },
      eventIds,
    };
  }
  const memories = parseMemories(recall.call);
  // Two anchors: recall's semantic neighbors AND the recent window. The
  // 2026-11-22 re-run proof showed recall alone can miss a stored near-dup
  // (dice 0.714, never returned) — the window is what bounds the gate.
  const candidates = [...memories, ...prior];

  // Exact match: idempotent — the fact is already hers.
  const normalized = normalizeText(fact.content);
  const exact = candidates.find((m) => normalizeText(m.value_text) === normalized);
  if (exact) return { outcome: { status: 'already', memory: exact }, eventIds };

  // Close variant: seme already holds a related memory in different words.
  // Charlie's stored copy is the authoritative edit — keep it, flag this,
  // never write over the doubt.
  const factTokens = tokenSet(fact.content);
  const near = candidates
    .map((m) => ({ m, d: dice(factTokens, tokenSet(m.value_text)) }))
    .filter((x) => x.d >= NEAR_DICE)
    .sort((a, b) => b.d - a.d)[0];
  if (near) return { outcome: { status: 'conflict', kept: near.m }, eventIds };

  if (dryRun) {
    // Seed the window anyway: a later fact rewording this one conflicts in
    // the real run, and the dry run must predict that.
    prior.push(thisRun(fact, '(dry)'));
    return { outcome: { status: 'would-save' }, eventIds };
  }

  // New fact: save verbatim, then prove it retrievable (the read-back).
  const save = await auditedCall(mcp, 'seme_save', {
    content: fact.content,
    kind: fact.kind,
    session_id: fact.sessionId,
  });
  eventIds.push(save.eventId);
  if (!save.call.ok) {
    return {
      outcome: { status: 'failed', message: `seme_save: ${save.call.error?.message ?? 'failed'}` },
      eventIds,
    };
  }
  const turn = (save.call.result as { turn_id?: string } | null)?.turn_id ?? '';
  // What this run saves becomes a candidate for the facts after it.
  prior.push(thisRun(fact, turn));

  const verify = await auditedCall(mcp, 'seme_recall', recallArgs);
  eventIds.push(verify.eventId);
  if (!verify.call.ok) {
    return {
      outcome: {
        status: 'saved',
        turnId: turn,
        verified: false,
        note: `read-back recall failed: ${verify.call.error?.message ?? 'failed'}`,
      },
      eventIds,
    };
  }
  const verified = parseMemories(verify.call).some(
    (m) => normalizeText(m.value_text) === normalized,
  );
  return {
    outcome: verified
      ? { status: 'saved', turnId: turn, verified: true }
      : {
          status: 'saved',
          turnId: turn,
          verified: false,
          note: 'read-back recall did not return the fact',
        },
    eventIds,
  };
}

// ------------------------------------------------------------------- I/O

function readStdin(): Promise<string> {
  return new Promise((resolve) => {
    if (process.stdin.isTTY) {
      resolve('');
      return;
    }
    let data = '';
    process.stdin.setEncoding('utf-8');
    process.stdin.on('data', (c) => (data += c));
    process.stdin.on('end', () => resolve(data));
    process.stdin.on('error', () => resolve(data));
  });
}

interface ParsedArgs {
  dryRun: boolean;
  session: string;
  help: boolean;
}

function parseArgs(argv: string[]): { args: ParsedArgs; error: string | null } {
  const out: ParsedArgs = {
    dryRun: false,
    session: `reflect-${new Date().toISOString().replace(/[-:]/g, '').slice(0, 15)}`,
    help: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === '--dry-run') out.dryRun = true;
    else if (a === '--help' || a === '-h') out.help = true;
    else if (a === '--session') {
      const v = argv[i + 1];
      if (!v) return { args: out, error: '--session needs a value' };
      out.session = v;
      i++;
    } else return { args: out, error: `unknown argument: ${a}` };
  }
  return { args: out, error: null };
}

const USAGE = `memory-reflect — upsert a session's durable facts to seme.

Usage: cat facts.jsonl | node systems/memory/reflect.ts [--session <id>] [--dry-run]

Each stdin line: {"content": "the fact, verbatim", "kind": "fact", "session_id": "optional"}
Kinds: fact, preference, routine, decision, interest, relationship, reference, anti_pattern, observation.

Dedup gate per fact, over TWO anchors: seme_recall's results plus the recent
window (one seme_list_memories call per run — the newest 200 active memories —
plus facts saved earlier this run). Exact match -> already stored; close
variant -> conflict, flagged, never written; no match -> seme_save verbatim +
a read-back recall. One events row per MCP call; one runs row per routine
run. Never calls seme_correct or seme_forget — nothing destructive has a path
here.

Exit: 0 clean; 1 conflict/failed/unverified facts; 2 usage/config error.`;

/** Parse and validate the fact lines. Named errors, line by line. */
function parseFacts(raw: string): { facts: Fact[]; error: string | null } {
  const facts: Fact[] = [];
  const lines = raw.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const text = lines[i]!.trim();
    if (!text) continue;
    let obj: Record<string, unknown>;
    try {
      obj = JSON.parse(text) as Record<string, unknown>;
    } catch {
      return { facts, error: `stdin line ${i + 1}: not JSON — ${slice(text)}` };
    }
    if (typeof obj['content'] !== 'string' || obj['content'].trim() === '') {
      return { facts, error: `stdin line ${i + 1}: "content" must be a non-empty string` };
    }
    let kind = 'fact';
    if (obj['kind'] !== undefined) {
      if (typeof obj['kind'] !== 'string' || !KINDS.has(obj['kind'])) {
        return {
          facts,
          error: `stdin line ${i + 1}: unknown kind ${JSON.stringify(obj['kind'])} — valid: ${[...KINDS].join(', ')}`,
        };
      }
      kind = obj['kind'];
    }
    let sessionId: string | undefined;
    if (obj['session_id'] !== undefined) {
      if (typeof obj['session_id'] !== 'string') {
        return { facts, error: `stdin line ${i + 1}: "session_id" must be a string` };
      }
      sessionId = obj['session_id'];
    }
    facts.push({ content: obj['content'], kind, sessionId });
  }
  return { facts, error: null };
}

export async function runReflect(raw: string, argv: string[] = []): Promise<number> {
  const { args, error: argError } = parseArgs(argv);
  if (argError) {
    process.stderr.write(`reflect: ${argError}\n`);
    return 2;
  }
  if (args.help) {
    process.stdout.write(`${USAGE}\n`);
    return 0;
  }

  // Usage errors exit before any row is written (nothing external happened).
  const { facts, error: factError } = parseFacts(raw);
  if (factError) {
    process.stderr.write(`reflect: ${factError}\n`);
    return 2;
  }
  if (facts.length === 0) {
    process.stderr.write(
      'reflect: no facts on stdin — expected JSONL, e.g. {"content": "...", "kind": "fact"}\n',
    );
    return 2;
  }

  const command = process.env.SEME_MCP_CMD;
  if (!command) {
    process.stderr.write(
      'reflect: SEME_MCP_CMD is not set — point it at the seme MCP server command (see ~/.pi/agent/mcp.json, e.g. "node /path/to/seme-monorepo/apps/api/dist/mcp/mcp-server.js").\n',
    );
    return 2;
  }

  const session = args.session;
  const runId = logRun('memory-reflect', {
    status: 'invoked',
    context: { facts: facts.length, dry_run: args.dryRun, session },
  });

  let mcp: SemeMcp;
  try {
    mcp = new SemeMcp(command);
    await mcp.initialize();
  } catch (e) {
    const message = (e as Error).message;
    process.stderr.write(`reflect: ${message}\n`);
    finishRun(runId, { status: 'failed', exitCode: 1, message });
    return 1;
  }

  // Anchor 2 — the recent window. One seme_list_memories call per run:
  // the newest RECENT_WINDOW active memories, where conversation-end dupes
  // live. Recall alone proved too narrow live (2026-11-22 re-run proof): a
  // reworded fact scored dice 0.714 against its stored copy but never
  // appeared in recall's top-N, and a duplicate was saved. A list failure
  // only narrows the gate back to recall — named on stderr, never fatal.
  const eventIds: number[] = [];
  const prior: SemeMemory[] = [];
  let windowCount = 0; // the fetched window — prior grows with this-run saves, this doesn't
  const list = await auditedCall(mcp, 'seme_list_memories', {
    status: 'active',
    limit: RECENT_WINDOW,
  });
  eventIds.push(list.eventId);
  if (list.call.ok) {
    prior.push(...parseMemories(list.call));
    windowCount = prior.length;
  } else {
    process.stderr.write(
      `reflect: seme_list_memories failed (${list.call.error?.message ?? 'unknown'}) — continuing with recall-only dedup\n`,
    );
  }

  process.stdout.write(
    `memory-reflect: ${facts.length} fact${facts.length === 1 ? '' : 's'} → session ${session}` +
      `${args.dryRun ? ' (dry run)' : ''} — dedup window: ${windowCount}\n`,
  );

  const counts = { saved: 0, already: 0, conflict: 0, failed: 0, unverified: 0, would: 0 };
  for (const fact of facts) {
    const target = fact.sessionId ?? session;
    const { outcome, eventIds: ids } = await processFact(
      mcp,
      { ...fact, sessionId: target },
      args.dryRun,
      prior,
    );
    eventIds.push(...ids);
    switch (outcome.status) {
      case 'saved':
        counts.saved++;
        if (!outcome.verified) counts.unverified++;
        process.stdout.write(
          `SAVED       turn ${slice(outcome.turnId, 18) || '(no id)'}  "${slice(fact.content)}" (${fact.kind})` +
            (outcome.verified
              ? ' — read-back verified\n'
              : ` — UNVERIFIED: ${outcome.note ?? 'read-back failed'}\n`),
        );
        break;
      case 'would-save':
        counts.would++;
        process.stdout.write(
          `WOULD-SAVE  "${slice(fact.content)}" (${fact.kind}) — dry run, nothing written\n`,
        );
        break;
      case 'already':
        counts.already++;
        process.stdout.write(
          `ALREADY     ${slice(outcome.memory.id, 18)}  "${slice(outcome.memory.value_text)}"` +
            (outcome.memory.observed_at
              ? ` (observed ${slice(outcome.memory.observed_at, 20)})`
              : '') +
            ' — nothing written\n',
        );
        break;
      case 'conflict':
        counts.conflict++;
        process.stdout.write(
          `CONFLICT    kept ${slice(outcome.kept.id, 18)}  seme: "${slice(outcome.kept.value_text)}" — incoming "${slice(fact.content)}" differs; kept seme's, flagged for review\n`,
        );
        break;
      case 'failed':
        counts.failed++;
        process.stdout.write(`FAILED      "${slice(fact.content)}" — ${outcome.message}\n`);
        break;
    }
  }
  mcp.close();

  const findings = counts.conflict + counts.failed + counts.unverified;
  const exit = findings > 0 ? 1 : 0;
  const message =
    `window=${windowCount} saved=${counts.saved}${args.dryRun ? ` would=${counts.would}` : ''} already=${counts.already}` +
    ` conflict=${counts.conflict} failed=${counts.failed} unverified=${counts.unverified}` +
    `; mcp events: ${eventIds.join(',') || 'none'}`;
  finishRun(runId, {
    status: 'completed',
    exitCode: exit,
    message,
  });
  process.stdout.write(
    `summary: ${message} — run ${runId}${exit === 0 ? '' : ` — exit ${exit} (findings need eyes)`}\n`,
  );
  return exit;
}

/** Loaded by path from tests/agent/run_module.ts, which knip can't see. @public */
export async function main(): Promise<number> {
  return runReflect(await readStdin(), process.argv.slice(2));
}
