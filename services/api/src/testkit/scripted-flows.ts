// Scripted answers for the natural-language flows in scripts/live-chat-flows.ts, so the
// flow harness itself can run against a local API with ENV=scripted — no model and no key.
// The scripted assistant behaves like a good one: it reads before it writes, resolves ids
// from tool results, and only calls tools that the request actually exposed.

export type ScriptedFlowContext = {
  userText: string;
  toolNames: ReadonlySet<string>;
  // Tool results since the latest user message, oldest first.
  turnResults: readonly { name: string; content: string }[];
};

export type ScriptedFlowStep = { tool: string; args: Record<string, unknown> } | { text: string };

const DAY_MS = 86_400_000;
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

// The next time "<month> <day>" comes around, as an ISO timestamp.
function nextOccurrence(month: string, day: number): string {
  const monthIndex = MONTHS.indexOf(month.toLowerCase());
  const now = Date.now();
  let year = new Date(now).getUTCFullYear();
  if (Date.UTC(year, monthIndex, day, 12) < now) year += 1;
  return new Date(Date.UTC(year, monthIndex, day, 12)).toISOString();
}

type ListedTask = { id: string; title: string; dueAt: string | null };

function tasksIn(content: string | undefined): ListedTask[] {
  try {
    const parsed: unknown = JSON.parse(content ?? '');
    if (typeof parsed !== 'object' || parsed === null || !('tasks' in parsed)) return [];
    const { tasks } = parsed;
    if (!Array.isArray(tasks)) return [];
    return tasks.flatMap((task: unknown) =>
      typeof task === 'object' &&
      task !== null &&
      'id' in task &&
      typeof task.id === 'string' &&
      'title' in task &&
      typeof task.title === 'string'
        ? [
            {
              id: task.id,
              title: task.title,
              dueAt: 'dueAt' in task && typeof task.dueAt === 'string' ? task.dueAt : null,
            },
          ]
        : [],
    );
  } catch {
    return [];
  }
}

export function scriptedFlowStep(context: ScriptedFlowContext): ScriptedFlowStep | null {
  const { userText: text, turnResults: results, toolNames } = context;
  const step = results.length;
  const call = (tool: string, args: Record<string, unknown>): ScriptedFlowStep =>
    toolNames.has(tool) ? { tool, args } : { text: `i can't do that here (no ${tool})` };

  const renew = text.match(/renew my passport on (\w+) (\d+)/i);
  if (renew) {
    return step === 0
      ? call('task_create', {
          title: 'Renew passport',
          artifactType: 'task',
          dueAt: nextOccurrence(renew[1] ?? '', Number(renew[2])),
        })
      : { text: 'got it, i added a task to renew your passport.' };
  }

  if (/push it back a week/i.test(text)) {
    if (step === 0) return call('task_list', {});
    const task = tasksIn(results[0]?.content).find((candidate) =>
      /passport/i.test(candidate.title),
    );
    if (step === 1 && task?.dueAt) {
      return call('task_update', {
        id: task.id,
        data: {
          priority: 'high',
          dueAt: new Date(Date.parse(task.dueAt) + 7 * DAY_MS).toISOString(),
        },
      });
    }
    return { text: 'done, it is a week later and high priority.' };
  }

  if (/coming up for passport/i.test(text)) {
    return step === 0
      ? call('task_list', { query: 'passport' })
      : { text: 'you have one passport task coming up.' };
  }

  if (/(get rid of|delete) the gym/i.test(text)) {
    if (step === 0) return call('task_list', {});
    const gym = tasksIn(results[0]?.content).find((task) => /gym/i.test(task.title));
    if (step === 1 && gym) return call('task_delete', { id: gym.id });
    return /rejected/i.test(results[step - 1]?.content ?? '')
      ? { text: "ok, i'll leave it alone." }
      : { text: 'done, i deleted the gym membership task.' };
  }

  if (/and the passport one/i.test(text)) {
    return step === 0
      ? call('task_list', {})
      : {
          text: 'there are two passport tasks: renew passport and the photo appointment. which one?',
        };
  }

  if (/lactose intollerant/i.test(text)) {
    const sequence: ScriptedFlowStep[] = [
      // Any completed read unlocks the writes that follow.
      call('list_memories', {}),
      call('remember', { content: 'The user is lactose intolerant.' }),
      call('note_create', {
        title: 'google home setup',
        content: '1. unbox it\n2. pair it\n3. name the room',
      }),
      call('task_create', { title: 'Buy a smart plug', artifactType: 'task' }),
    ];
    return (
      sequence[step] ?? { text: 'all done: i remembered it, saved the note and added the task.' }
    );
  }

  if (/latte/i.test(text)) {
    return step === 0
      ? call('search_memories', { query: 'lactose' })
      : { text: 'you are lactose intolerant, so maybe try oat milk in it.' };
  }

  return null;
}
