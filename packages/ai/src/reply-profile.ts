import type { ChatMessages } from '@openrouter/sdk/models';

/**
 * Reply length and output-cap policy, shared by every surface that talks to a chat model.
 *
 * The split that matters:
 * - The prompt (plus a reminder on the last user turn) sets how long a reply is.
 * - The output cap is only a ceiling for runaway generations. It is generous on purpose, because
 *   reasoning tokens count against it and thinking is fine. Never use it to shorten a reply: the
 *   model cannot see it, so a reply that hits it just stops mid-sentence.
 */

export type ReplyLengthId = 'short' | 'medium' | 'long';

export type ReplyLengthProfile = {
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
  short: {
    guidance: `RESPONSE LENGTH: One to three short sentences, under sixty words. Lead with the point, skip everything else. ${NOT_SET_BY_EARLIER_REPLIES}`,
    reminder: '(Answer in one to three short sentences, under sixty words.)',
    targetWords: { min: 1, max: 60 },
  },
  medium: {
    guidance: `RESPONSE LENGTH: A response that takes about 3-5 minutes to read (roughly 600-1000 words). Cover the topic properly, but don't ramble. ${NOT_SET_BY_EARLIER_REPLIES}`,
    reminder: '(Answer in roughly 600 to 1000 words.)',
    targetWords: { min: 500, max: 1100 },
  },
  long: {
    guidance: `RESPONSE LENGTH: A long-form essay (roughly 1500-3000 words). Before writing, silently plan a short outline for yourself based on what the user asked — the sections/angles you'll cover and the order that makes sense — then write the full essay from that outline. Do not print the outline itself, just the finished essay with clear structure (e.g. headers or clearly delineated sections). ${NOT_SET_BY_EARLIER_REPLIES}`,
    reminder: '(Give the full essay, roughly 1500 to 3000 words.)',
    targetWords: { min: 1400, max: 3200 },
  },
};

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
