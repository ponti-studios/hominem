import type { AssertionValueFunctionContext } from 'promptfoo';

/** Non-empty and at most `config.maxChars` characters. */
export default function concise(output: string, context: AssertionValueFunctionContext) {
  const maxChars = Number(context.config?.maxChars ?? 400);
  const text = output.trim();
  if (!text) return { pass: false, score: 0, reason: 'empty response' };
  if (text.length > maxChars) {
    return { pass: false, score: 0, reason: `not concise (${text.length} > ${maxChars} chars)` };
  }
  return { pass: true, score: 1, reason: `${text.length} chars` };
}
