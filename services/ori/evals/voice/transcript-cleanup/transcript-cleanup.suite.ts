import { loadJson, renderMessages, type Golden, type PromptMessage } from '../../lib/golden';
import { voiceCleanupSchema } from '../../lib/schemas';
import { defineTextSuite } from '../../lib/suite';

const promptUrl = new URL('./system-prompt.json', import.meta.url);
const casesUrl = new URL('./expected-cases.json', import.meta.url);
const prompt = await loadJson<PromptMessage[]>(promptUrl);

export default await defineTextSuite({
  name: 'voice-cleanup',
  description: 'Voice transcript cleanup keeps meaning and drops filler',
  tier: 'capability',
  cases: await loadJson<Golden[]>(casesUrl),
  datasetFiles: [casesUrl],
  promptFiles: [promptUrl],
  messages: (golden) => renderMessages(prompt, { rawText: golden.input }),
  schema: voiceCleanupSchema,
  rubric: [
    'Compare actual output to the reference while allowing harmless punctuation and capitalization differences.',
    'Require names, numbers, dates, meaning, and intent to remain intact.',
    'Require filler and repeated speech fragments to be removed without summarizing or inventing content.',
  ].join('\n'),
});
