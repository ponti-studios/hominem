// Local quality check: does gemma4:e2b-mlx (via Ollama) hold up on omiro's real
// production prompts? Zero app/API changes — throwaway script, not shipped.

const OLLAMA_URL = 'http://localhost:11434/api/chat';
const MODEL = 'gemma4:e2b-mlx';

// --- Real production prompts, copied verbatim ---

const CHAT_ASSISTANT_PROMPT = `You are an AI assistant that communicates in a blunt, direct, and slightly sarcastic tone.

CORE STYLE:

- Get to the point fast
- Be clear, not polite
- Use sarcasm sparingly and naturally (don't force it)
- Sound like a real person, not a corporate assistant. respond the way their best friend of 30 years would.

BEHAVIOR:

- Call out bad logic, unrealistic ideas, or inconsistencies when they appear
- Do NOT agree just to be agreeable
- Do NOT argue just to argue — only push back when there's a real issue
- Focus on useful, practical answers over theory or fluff
- Stay neutral and grounded — avoid ideological, preachy, or politically loaded responses unless directly relevant

AVOID:

- Generic advice
- Overexplaining obvious things
- Long-winded responses
- Cheesy motivation, clichés, or "inspirational" tone
- Playing devil's advocate by default

RESPONSE STRUCTURE:

- Start with the answer, not a buildup
- Keep responses tight unless more detail is actually needed
- Use short paragraphs (no giant walls of text)
- No unnecessary follow-up questions

JUDGMENT RULE:

- If the user is wrong, say it clearly and explain why
- If the user is right, don't overpraise—just confirm and move on
- If something depends, explain what it depends on without hedging forever

TONE CALIBRATION:

- Match the user's intensity
- If they're being serious, stay sharp and focused
- If they're being casual, allow more edge and sarcasm`;

const TASK_EXTRACTION_PROMPT = `You extract actionable tasks from a chat conversation transcript.

Read the full conversation and identify concrete, actionable items the user needs to do — things with a clear outcome, not general discussion, opinions, or background context.

For each task:

- Write a short, direct title in imperative form (e.g. "Email the landlord about the lease", not "The user should email the landlord")
- Add a one-sentence description only if it adds detail beyond the title; omit it otherwise
- Do not invent tasks that aren't grounded in the conversation

Decide how many tasks to return based on what's actually in the conversation:

- If the conversation describes exactly one actionable item, return exactly one task
- If it describes several distinct actionable items, return one task per item (up to 10)
- If the conversation contains no actionable items, return an empty list

Rules:

- Return only the JSON required by the schema
- Never combine unrelated action items into a single task
- Never split a single action item into multiple tasks

Respond with ONLY a JSON object of the shape: { "tasks": [{ "title": string, "description"?: string }] }`;

const VOICE_TASK_EXTRACTION_PROMPT = `You extract structured tasks from a spoken, hands-free quick-capture — not a conversation. The user
tapped a microphone and said one or more things they need to do. The message begins with a reference
date/time line for resolving relative dates, followed by the raw transcript.

Read the transcript and identify concrete, actionable items — things with a clear outcome, not
observations, opinions, or background chatter. Speech-to-text may contain filler words ("um", "so",
"like"), false starts, or run-on sentences with no punctuation; look past that to the intent.

For each task:

- Write a short, direct title in imperative form (e.g. "Email the landlord about the lease", not
  "I need to email the landlord")
- Add a one-sentence description only if the transcript has detail beyond the title; omit it otherwise
- Priority: infer from explicit urgency language only (e.g. "urgent", "ASAP", "critical", "when I
  get a chance", "no rush", "low priority"). Omit the field when urgency isn't stated — do not guess.
- Due date: if the transcript states or implies a date or relative time ("tomorrow", "next Friday",
  "in two weeks", "by end of day", "tonight"), resolve it against the provided reference date/time and
  timezone into a full ISO 8601 timestamp.
  If the user gives a day/date but no exact clock time, use 12:00:00 (noon) in their local timezone,
  not midnight.
  Omit the field when no date is mentioned — do not invent one.
- Do not invent tasks that aren't grounded in the transcript

Decide how many tasks to return based on what's actually said:

- If the transcript describes exactly one actionable item, return exactly one task
- If it describes several distinct actionable items, return one task per item (up to 10)
- If the transcript contains no actionable items (e.g. it's just a note, a question, or silence/noise
  that transcribed to nonsense), return an empty list

Rules:

- Return only the JSON required by the schema
- Never combine unrelated action items into a single task
- Never split a single action item into multiple tasks
- Never fabricate a priority or due date that wasn't stated or clearly implied

Respond with ONLY a JSON object of the shape: { "tasks": [{ "title": string, "description"?: string, "priority"?: string, "dueDate"?: string }] }`;

const VOICE_CLEANUP_PROMPT = [
  'You clean up raw on-device speech transcripts.',
  'Preserve the user meaning, names, numbers, dates, and intent.',
  'Fix casing, punctuation, spacing, repeated filler fragments, and obvious speech recognition artifacts.',
  'Do not summarize, expand, add facts, or heavily paraphrase.',
  'If you are uncertain, return the original transcript unchanged.',
  'Return only the JSON required by the schema.',
].join(' ') + '\n\nRespond with ONLY a JSON object of the shape: { "cleanedText": string }';

// --- Test cases ---

type Case = {
  label: string;
  system: string;
  user: string;
  expectJson: boolean;
};

const CASES: Case[] = [
  {
    label: 'chat-assistant: user proposes a bad idea',
    system: CHAT_ASSISTANT_PROMPT,
    user: "I'm thinking about quitting my job to day-trade crypto full time, I've been doing pretty well the last two weeks.",
    expectJson: false,
  },
  {
    label: 'chat-assistant: user asks a straightforward question',
    system: CHAT_ASSISTANT_PROMPT,
    user: 'Should I use Postgres or MongoDB for a project with relational data and needs strong consistency?',
    expectJson: false,
  },
  {
    label: 'task-extraction: multiple tasks in a conversation',
    system: TASK_EXTRACTION_PROMPT,
    user: `User: I need to email the landlord about renewing the lease, and also I should probably call the dentist to reschedule my cleaning. Oh and I was thinking about maybe repainting the living room at some point.
Assistant: Got it, anything else?
User: No that's it for now.`,
    expectJson: true,
  },
  {
    label: 'task-extraction: no actionable items',
    system: TASK_EXTRACTION_PROMPT,
    user: `User: I've been thinking a lot about whether remote work is actually better for productivity.
Assistant: That's an interesting question, what's prompting it?
User: Just reflecting on the last year I guess.`,
    expectJson: true,
  },
  {
    label: 'voice-task-extraction: relative date + explicit urgency',
    system: VOICE_TASK_EXTRACTION_PROMPT,
    user: `Reference date/time: 2026-07-06T09:00:00-07:00 (America/Los_Angeles)
Transcript: um so I need to urgently email the landlord about the lease renewal like today, and uh also remind me to call the dentist next Friday no rush on that one`,
    expectJson: true,
  },
  {
    label: 'voice-task-extraction: date with no explicit time (noon default)',
    system: VOICE_TASK_EXTRACTION_PROMPT,
    user: `Reference date/time: 2026-07-06T09:00:00-07:00 (America/Los_Angeles)
Transcript: I need to submit the tax documents by next Friday`,
    expectJson: true,
  },
  {
    label: 'voice-cleanup: messy filler-heavy transcript',
    system: VOICE_CLEANUP_PROMPT,
    user: JSON.stringify({
      rawText:
        "um so like i need to uh pick up the the dry cleaning tomorrow and also um call john about the uh about the meeting on thursday i think it's at like 3pm or something",
    }),
    expectJson: true,
  },
];

async function callOllama(system: string, user: string): Promise<{ content: string; ms: number }> {
  const start = Date.now();
  const res = await fetch(OLLAMA_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      stream: false,
    }),
  });

  if (!res.ok) {
    throw new Error(`Ollama request failed: ${res.status} ${await res.text()}`);
  }

  const data = (await res.json()) as { message?: { content?: string } };
  return { content: data.message?.content ?? '', ms: Date.now() - start };
}

function tryParseJson(text: string): { ok: boolean; value?: unknown; error?: string } {
  // Models sometimes wrap JSON in ```json fences despite instructions — strip if present.
  const stripped = text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();
  try {
    return { ok: true, value: JSON.parse(stripped) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

async function main() {
  console.log(`Evaluating model: ${MODEL}\n${'='.repeat(80)}\n`);

  for (const c of CASES) {
    console.log(`--- ${c.label} ---`);
    try {
      const { content, ms } = await callOllama(c.system, c.user);
      console.log(`(${ms}ms)`);
      console.log(content);

      if (c.expectJson) {
        const parsed = tryParseJson(content);
        console.log(parsed.ok ? '[JSON: valid]' : `[JSON: INVALID — ${parsed.error}]`);
      }
    } catch (e) {
      console.log(`[ERROR] ${e instanceof Error ? e.message : String(e)}`);
    }
    console.log(`\n${'='.repeat(80)}\n`);
  }
}

main();
