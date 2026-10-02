/**
 * Multi-turn chat flows against a running API and the real model. Each flow is a
 * conversation written the way people actually talk: lowercase, no verbs like "add a
 * task", missing details, pronouns, a typo. They check that the assistant infers
 * intent, resolves "it" and "the gym thing" to real records, keeps destructive actions
 * behind confirmation, and works across several capabilities in one message.
 *
 * Usage (API running, signed-in session exported by `pnpm e2e:setup`):
 *   API_URL=http://localhost:4040 E2E_SESSION_COOKIE=... pnpm --filter @hominem/api live-chat-flows
 *
 * Asserts on tool calls and the data they leave behind, never on wording (a live
 * model's text varies); the only text checks are for a fact we planted ourselves.
 * Because the model is nondeterministic, every flow runs FLOW_SAMPLES times from a clean
 * account and passes when at least FLOW_MIN_PASS_RATE of the samples do. With
 * FLOW_EARLY_STOP=1 it stops sampling a flow as soon as that rate is reached.
 * FLOW_CASES=task-follow-ups limits the run to some flows.
 *
 * Run it only against the dedicated test account: it deletes that account's tasks and
 * memories before every sample.
 */

import { appendFileSync } from 'node:fs';

import {
  createdIds,
  createTask,
  deleteMemory,
  deleteNote,
  deleteTask,
  describeFailedCalls,
  getNote,
  listMemories,
  listTasks,
  mergeTurns,
  respondToConfirmation,
  runTurn,
  type Turn,
} from './live-chat-client';

const SAMPLES = Number(process.env.FLOW_SAMPLES ?? 2);
const MIN_PASS_RATE = Number(process.env.FLOW_MIN_PASS_RATE ?? 0.5);
const EARLY_STOP = process.env.FLOW_EARLY_STOP === '1';
const DAY_MS = 86_400_000;

// ── dates, phrased the way people say them ─────────────────────────────────

const MONTHS = [
  'january',
  'february',
  'march',
  'april',
  'may',
  'june',
  'july',
  'august',
  'september',
  'october',
  'november',
  'december',
];

function ordinal(day: number): string {
  const lastTwo = day % 100;
  if (lastTwo >= 11 && lastTwo <= 13) return `${day}th`;
  return `${day}${{ 1: 'st', 2: 'nd', 3: 'rd' }[day % 10] ?? 'th'}`;
}

// A date `offsetDays` from now, as a person would say it ("march 15th") and as an ISO date.
// Built from the run date so the flow is valid all year and a model that picks a date in
// the past gets caught.
function naturalDate(offsetDays: number) {
  const date = new Date(Date.now() + offsetDays * DAY_MS);
  return {
    phrase: `${MONTHS[date.getUTCMonth()]} ${ordinal(date.getUTCDate())}`,
    iso: date.toISOString().slice(0, 10),
  };
}

// Models pick their own time of day and timezone, so allow a day and a half either way.
function isAround(dueAt: string | null | undefined, isoDate: string): boolean {
  if (!dueAt) return false;
  return Math.abs(Date.parse(dueAt) - Date.parse(`${isoDate}T12:00:00Z`)) <= 1.5 * DAY_MS;
}

// ── a conversation, with the small amount of manners a real user has ───────

class Conversation {
  chatId: string | null = null;
  // Times the assistant asked a question instead of acting; recorded, not failed.
  asked = 0;
  observations: string[] = [];
  noteIds: string[] = [];

  /**
   * Says something. If the assistant answers with a question, replies with `ifAsked`
   * (when given) the way a person would, and returns both turns as one.
   */
  async say(message: string, options: { ifAsked?: string; newChat?: boolean } = {}) {
    if (options.newChat) this.chatId = null;
    let turn = await runTurn(message, this.chatId);
    this.chatId = turn.chatId ?? this.chatId;
    // A question after the assistant already did the thing ("anything else?") is not a request
    // for more detail, so it gets no answer; answering it would just do the thing twice.
    if (options.ifAsked && !turn.pending && !changedData(turn) && turn.text.trim().endsWith('?')) {
      this.asked++;
      turn = mergeTurns(turn, await runTurn(options.ifAsked, this.chatId));
    }
    this.noteIds.push(...createdIds(turn, 'note_create', 'note'));
    return turn;
  }
}

const isRead = (tool: string) =>
  /^(list_|search_)|^semantic_search$|_(list|detail|get)$/.test(tool);

// Whether any tool that changes data completed in this turn.
const changedData = (turn: Turn) =>
  turn.completed.some((call) => !call.error && !isRead(call.name));

const hasCompleted = (turn: Turn, tool: string) =>
  turn.completed.some((call) => call.name === tool && !call.error);

const wrote = (turn: Turn) =>
  turn.completed.some(
    (call) =>
      !call.error &&
      ['task_create', 'task_update', 'task_delete', 'task_complete'].includes(call.name),
  );

// What the assistant did and, when it said something, how it replied (job log only).
const summarize = (turn: Turn) => {
  const reply = turn.text.trim().replace(/\s+/g, ' ');
  return `requested: ${turn.requested.join(', ') || 'none'}${describeFailedCalls(turn)}${
    reply ? ` | reply: "${reply.length > 240 ? `${reply.slice(0, 240)}…` : reply}"` : ''
  }`;
};

// ── flows ──────────────────────────────────────────────────────────────────

type Flow = {
  name: string;
  // Returns why the flow failed, or null when the assistant behaved correctly.
  run: (conversation: Conversation) => Promise<string | null>;
};

const flows: Flow[] = [
  {
    // Intent without a verb, a year left out, "it" for the task, relative dates and a
    // fuzzy priority word, then a question about what was saved.
    name: 'task-follow-ups',
    run: async (conversation) => {
      const target = naturalDate(45);

      let turn = await conversation.say(`i need to renew my passport on ${target.phrase}`, {
        ifAsked: 'yeah just add it to my list',
      });
      const created = (await listTasks()).filter((task) => /passport/i.test(task.title));
      if (created.length !== 1) {
        return `step 1: expected one passport task, found ${created.length} (${summarize(turn)})`;
      }
      const original = created[0];
      if (!original || !isAround(original.dueAt, target.iso)) {
        return `step 1: due date ${original?.dueAt} is not around ${target.iso}`;
      }

      turn = await conversation.say('can you push it back a week and make it a big priority', {
        ifAsked: 'the passport one',
      });
      const updated = (await listTasks()).filter((task) => /passport/i.test(task.title));
      if (updated.length !== 1) {
        return `step 2: expected still one passport task, found ${updated.length} (${summarize(turn)})`;
      }
      const task = updated[0];
      if (!task || task.id !== original.id) return 'step 2: the original task is gone';
      if (task.priority !== 'high') {
        return `step 2: priority is ${task.priority}, expected high (${summarize(turn)})`;
      }
      const movedDays = (Date.parse(task.dueAt ?? '') - Date.parse(original.dueAt ?? '')) / DAY_MS;
      if (!(movedDays >= 6 && movedDays <= 8)) {
        return `step 2: due date moved ${movedDays} days, expected about 7 (${summarize(turn)})`;
      }

      turn = await conversation.say('wait what do i have coming up for passport stuff');
      if (!hasCompleted(turn, 'task_list'))
        return `step 3: never looked at the tasks (${summarize(turn)})`;
      if (wrote(turn)) return 'step 3: changed a task while only being asked a question';
      if (!turn.text.trim()) return 'step 3: empty reply';
      return null;
    },
  },
  {
    // Destructive actions stay behind confirmation, "the gym thing" resolves to the right
    // record among near-duplicates, and an ambiguous request is never carried out.
    name: 'delete-with-confirmation',
    run: async (conversation) => {
      await createTask('Renew passport');
      await createTask('Renew gym membership');
      await createTask('Passport photo appointment');
      const titles = async () => (await listTasks()).map((task) => task.title).sort();
      const all = await titles();
      if (all.length !== 3) return `setup: expected 3 seeded tasks, found ${all.length}`;

      // 1. Ask, then reject the confirmation: nothing may be deleted.
      let turn = await conversation.say('can you get rid of the gym thing', {
        ifAsked: 'the gym membership one',
      });
      if (turn.pending?.toolName !== 'task_delete') {
        return `step 1: no delete confirmation was requested (${summarize(turn)})`;
      }
      if ((await titles()).length !== 3) return 'step 1: a task was deleted before approval';
      turn = await respondToConfirmation(turn, false);
      if ((await titles()).length !== 3) return 'step 1: a task was deleted after rejection';
      if (hasCompleted(turn, 'task_delete')) return 'step 1: task_delete ran after rejection';

      // 2. Say go ahead, approve: only the gym task goes.
      turn = await conversation.say('ok yeah delete the gym one', {
        ifAsked: 'yeah the gym membership one',
      });
      if (turn.pending?.toolName !== 'task_delete') {
        return `step 2: no delete confirmation was requested (${summarize(turn)})`;
      }
      turn = await respondToConfirmation(turn, true);
      const remaining = await titles();
      if (remaining.some((title) => /gym/i.test(title))) {
        return `step 2: the gym task still exists (${summarize(turn)})`;
      }
      if (remaining.length !== 2) {
        return `step 2: expected the other 2 tasks to remain, found ${remaining.length}`;
      }

      // 3. Two tasks match "the passport one": we never approve, so nothing can go.
      turn = await conversation.say('and the passport one');
      if ((await titles()).length !== 2) return 'step 3: a task was deleted without approval';
      conversation.observations.push(
        turn.pending
          ? 'guessed a passport task to delete (unapproved)'
          : turn.text.trim().endsWith('?')
            ? 'asked which passport task'
            : 'neither asked nor tried to delete',
      );
      return null;
    },
  },
  {
    // Three capabilities from one messy message (with a typo), then recall in a new chat.
    name: 'many-things-then-recall',
    run: async (conversation) => {
      let turn = await conversation.say(
        'ok so a few things. im lactose intollerant (remember that pls), i want a note called google home setup with the steps: unbox, pair it, name the room. and remind me to buy a smart plug',
        { ifAsked: 'yeah go ahead and do all of it' },
      );
      if (turn.failed) return `step 1: generation failed (${summarize(turn)})`;
      if (turn.requested.length > 12) {
        return `step 1: ${turn.requested.length} tool calls for three simple things`;
      }

      const memories = await listMemories();
      if (!memories.some((memory) => /lactos/i.test(memory.content))) {
        return `step 1: nothing about lactose was remembered (${summarize(turn)})`;
      }
      const noteId = conversation.noteIds[0];
      const note = noteId ? await getNote(noteId) : null;
      if (!note) return `step 1: no note was saved (${summarize(turn)})`;
      if (!/google home/i.test(note.title ?? '')) return 'step 1: the note has the wrong title';
      for (const step of [/unbox/i, /pair/i, /room/i]) {
        if (!step.test(note.content)) return `step 1: the note is missing the step ${step}`;
      }
      if (!(await listTasks()).some((task) => /smart plug/i.test(task.title))) {
        return `step 1: no smart plug task was created (${summarize(turn)})`;
      }

      turn = await conversation.say('can i get a latte? what do you know about me anyway', {
        newChat: true,
      });
      if (!hasCompleted(turn, 'search_memories') && !hasCompleted(turn, 'list_memories')) {
        return `step 2: never looked at its memories (${summarize(turn)})`;
      }
      if (!/lactos/i.test(turn.text)) return 'step 2: the reply does not mention lactose';
      return null;
    },
  },
];

// ── running ────────────────────────────────────────────────────────────────

// The account is the dedicated test account, so every sample starts from nothing.
async function resetAccount(conversation: Conversation) {
  for (const task of await listTasks()) await deleteTask(task.id);
  for (const memory of await listMemories()) await deleteMemory(memory.id);
  for (const id of conversation.noteIds) await deleteNote(id);
}

async function runSample(
  flow: Flow,
): Promise<{ reason: string | null; asked: number; notes: string[] }> {
  const conversation = new Conversation();
  let reason: string | null;
  try {
    await resetAccount(conversation);
    reason = await flow.run(conversation);
  } catch (error) {
    reason = error instanceof Error ? error.message : String(error);
  }
  await resetAccount(conversation).catch(() => undefined);
  return { reason, asked: conversation.asked, notes: conversation.observations };
}

const selected = (process.env.FLOW_CASES ?? '')
  .split(',')
  .map((name) => name.trim())
  .filter(Boolean);
const toRun = selected.length > 0 ? flows.filter((flow) => selected.includes(flow.name)) : flows;
if (toRun.length === 0) {
  console.error(`No flows match FLOW_CASES=${process.env.FLOW_CASES}`);
  process.exit(1);
}

const rows: string[] = [];
let failedFlows = 0;
for (const flow of toRun) {
  console.log(`▶ ${flow.name}`);
  let passes = 0;
  let ran = 0;
  let asked = 0;
  for (let sample = 1; sample <= SAMPLES; sample++) {
    const result = await runSample(flow);
    ran++;
    asked += result.asked;
    if (result.reason === null) passes++;
    const detail = result.notes.length > 0 ? ` [${result.notes.join('; ')}]` : '';
    console.log(
      result.reason === null
        ? `  sample ${sample}/${SAMPLES} ✓${detail}`
        : `  sample ${sample}/${SAMPLES} ✗ ${result.reason}${detail}`,
    );
    if (EARLY_STOP && passes / SAMPLES >= MIN_PASS_RATE) break;
  }
  const ok = passes / SAMPLES >= MIN_PASS_RATE;
  console.log(
    `  ${ok ? '✓' : '✗'} ${passes}/${ran} samples passed (need ${Math.ceil(SAMPLES * MIN_PASS_RATE)} of ${SAMPLES}); asked a question ${asked} time(s)`,
  );
  rows.push(
    `| ${flow.name} | ${ok ? 'pass' : 'FAIL (see job log)'} | ${passes}/${ran} | ${asked} |`,
  );
  if (!ok) failedFlows++;
}

if (process.env.GITHUB_STEP_SUMMARY) {
  appendFileSync(
    process.env.GITHUB_STEP_SUMMARY,
    `## Live chat flows\n\n| flow | result | samples passed | questions asked |\n| --- | --- | --- | --- |\n${rows.join('\n')}\n`,
  );
}
if (failedFlows > 0)
  console.log(`::warning::${failedFlows} live chat flow(s) below the pass-rate threshold`);
process.exit(failedFlows === 0 ? 0 : 1);
