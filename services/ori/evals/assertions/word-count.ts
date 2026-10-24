import type { AssertionValueFunctionContext } from 'promptfoo';

/**
 * Non-empty and at most `config.maxWords` words. Words, not characters: the chat prompt asks for a
 * short, direct answer without a count, so this is a loose ceiling that catches padding and not a
 * tight limit to tune the prompt against.
 */
export default function wordCount(output: string, context: AssertionValueFunctionContext) {
  const maxWords = Number(context.config?.maxWords ?? 90);
  const text = output.trim();
  if (!text) return { pass: false, score: 0, reason: 'empty response' };
  const words = text.split(/\s+/).length;
  if (words > maxWords) {
    return { pass: false, score: 0, reason: `too long (${words} > ${maxWords} words)` };
  }
  return { pass: true, score: 1, reason: `${words} words` };
}
