import {
  loadJson,
  registerJsonSuite,
  renderMessages,
  type Golden,
  type PromptMessage,
} from './lib/evaluator';
import { voiceCleanupSchema } from './lib/schemas';

const prompt = await loadJson<PromptMessage[]>(
  new URL('../data/voice-cleanup/prompt.json', import.meta.url),
);
const cases = await loadJson<Golden[]>(
  new URL('../data/voice-cleanup/goldens.json', import.meta.url),
);

registerJsonSuite({
  name: 'voice cleanup',
  cases,
  buildInput: (golden) => renderMessages(prompt, { rawText: golden.input }),
  outputSchema: voiceCleanupSchema,
  rubric: [
    'Compare actual output to the reference while allowing harmless punctuation, capitalization, and equivalent date/number wording differences (for example, "15th" and "fifteenth" mean the same date).',
    'Require names, numbers, dates, meaning, intent, and material uncertainty to remain intact. Do not penalize a candidate for preserving a hedge present in the source transcript (for example, "I think") even when the reference omits it.',
    'The reference is one acceptable cleanup, not the only correct wording. Pass any candidate that preserves the source meaning even when its wording differs from the reference; never require an exact match.',
    'Still require disfluencies to be removed: penalize leftover "um", "uh", stuttered repeats, and false starts. Uncertainty that carries speaker intent ("I think") must be preserved. A trailing "or something" is acceptable whether kept or dropped once "I think" is present; penalize dropping it only when that removes all uncertainty from the sentence.',
  ].join('\n'),
});
