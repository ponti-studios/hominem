import type { ChatMessages } from '@openrouter/sdk/models';

/**
 * Reply length, reply style, and output-cap policy, shared by every surface that talks to a chat
 * model (the API, Omiro, and Thames).
 *
 * The split that matters:
 * - The prompt (plus a reminder on the last user turn) sets how long a reply is.
 * - The output cap is only a ceiling for runaway generations. It is generous on purpose, because
 *   reasoning tokens count against it and thinking is fine. Never use it to shorten a reply: the
 *   model cannot see it, so a reply that hits it just stops mid-sentence.
 */

export const REPLY_LENGTH_IDS = ['brief', 'standard', 'deep'] as const;

export type ReplyLengthId = (typeof REPLY_LENGTH_IDS)[number];

export type ReplyLengthProfile = {
  /** The label and the one-line description people see in every picker. */
  name: string;
  note: string;
  /** Appended to the system prompt. */
  guidance: string;
  /** One line added to the end of the latest user message, in the request only. */
  reminder: string;
  /** Rough target, for evals and dashboards. Not enforced at runtime. */
  targetWords: { min: number; max: number };
};

/** A model copies the length of the replies already in the conversation unless told not to. */
const NOT_SET_BY_EARLIER_REPLIES = 'Earlier replies in this conversation do not set the length.';

export const REPLY_LENGTHS: Record<ReplyLengthId, ReplyLengthProfile> = {
  brief: {
    name: 'Brief',
    note: 'A few sentences · ~20 seconds',
    guidance: `Keep every answer to one to three short sentences, under fifty words, about twenty seconds when spoken. ${NOT_SET_BY_EARLIER_REPLIES}`,
    reminder: '(Answer in one to three short sentences, under fifty words.)',
    targetWords: { min: 1, max: 50 },
  },
  standard: {
    name: 'Standard',
    note: 'A couple of minutes',
    guidance: `Give substantial answers of roughly three hundred to four hundred words, about two to three minutes when spoken. ${NOT_SET_BY_EARLIER_REPLIES}`,
    reminder: '(Answer in roughly 300 to 400 words.)',
    targetWords: { min: 250, max: 450 },
  },
  deep: {
    name: 'Deep dive',
    note: 'About 10 minutes or more',
    guidance: `Give an extended, in-depth spoken talk that runs at least ten minutes when read aloud, which is at least sixteen hundred words. Give it a clear arc: set up the question, explore it from several angles with concrete examples, and finish with a real conclusion. Keep going until you have covered the topic thoroughly. Do not summarize, rush, or stop early. ${NOT_SET_BY_EARLIER_REPLIES}`,
    reminder: '(Give the full in-depth answer, at least 1,600 words.)',
    targetWords: { min: 1600, max: 3000 },
  },
};

export const DEFAULT_REPLY_LENGTH: ReplyLengthId = 'standard';

/** Ids that older apps and stored settings still send. They map onto the current levels. */
const LEGACY_REPLY_LENGTHS: Partial<Record<string, ReplyLengthId>> = {
  short: 'brief',
  medium: 'standard',
  long: 'deep',
};

/** The current id for a value that may be a current id or a legacy one. Undefined if neither. */
export function normalizeReplyLength(value: string | null | undefined): ReplyLengthId | undefined {
  if (!value) return undefined;
  return REPLY_LENGTH_IDS.find((id) => id === value) ?? LEGACY_REPLY_LENGTHS[value];
}

/**
 * Add the length reminder to the end of the latest user message. A model follows the last thing it
 * reads best. The input is not mutated, and the result is meant for the request only: never save it
 * to the conversation. A conversation that does not end on a plain-text user turn is returned as is.
 */
export function withLengthReminder(
  messages: ChatMessages[],
  length: ReplyLengthId | undefined,
): ChatMessages[] {
  if (!length) return messages;
  const last = messages[messages.length - 1];
  if (!last || last.role !== 'user' || typeof last.content !== 'string') return messages;
  return [
    ...messages.slice(0, -1),
    { ...last, content: `${last.content}\n\n${REPLY_LENGTHS[length].reminder}` },
  ];
}

/**
 * The generation ceiling. Deliberately large: it exists to stop a runaway, not to shape replies, and
 * reasoning tokens count against it.
 */
export const DEFAULT_MAX_OUTPUT_TOKENS = 32_000;

/** Models whose provider rejects the default ceiling. Keep provider quirks here, not at call sites. */
const MAX_OUTPUT_TOKEN_OVERRIDES: readonly { prefix: string; maxTokens: number }[] = [
  // Muse Spark takes a smaller completion budget than the default.
  { prefix: 'meta/muse-spark-1.3', maxTokens: 1_600 },
];

export function getMaxOutputTokens(model: string): number {
  return (
    MAX_OUTPUT_TOKEN_OVERRIDES.find((entry) => model.startsWith(entry.prefix))?.maxTokens ??
    DEFAULT_MAX_OUTPUT_TOKENS
  );
}

/** True when a stream ended because it ran into the output cap. */
export function hitOutputCap(finishReasons: readonly string[]): boolean {
  return finishReasons.some((reason) => reason === 'length' || reason === 'max_output_tokens');
}

/**
 * Reply style: who the assistant sounds like. Length is a separate axis (above). Shared so every
 * surface that talks to a model gets the same personas.
 */
export const REPLY_STYLE_IDS = ['partner', 'friend', 'straight'] as const;

export type ReplyStyleId = (typeof REPLY_STYLE_IDS)[number];

export type ReplyStyleProfile = {
  name: string;
  note: string;
  /** Appended to the system prompt. */
  guidance: string;
};

export const REPLY_STYLES: Record<ReplyStyleId, ReplyStyleProfile> = {
  partner: {
    name: 'Thinking partner',
    note: 'Curious · explores ideas',
    guidance:
      'REPLY STYLE: You are a thoughtful, curious discussion partner. Explore ideas with the user, offer angles they may not have considered, and follow tangents that matter.',
  },
  friend: {
    name: 'Warm friend',
    note: 'Relaxed · plain, friendly words',
    guidance:
      'REPLY STYLE: You are a warm, relaxed friend. Be encouraging and genuine, use plain everyday words, and keep a light touch of humor where it fits.',
  },
  straight: {
    name: 'Straight talker',
    note: 'Direct · no flattery',
    guidance:
      'REPLY STYLE: You are a direct, candid advisor. Say what you actually think, point out weak reasoning or blind spots politely but plainly, and skip flattery and filler.',
  },
};

export const DEFAULT_REPLY_STYLE: ReplyStyleId = 'partner';
