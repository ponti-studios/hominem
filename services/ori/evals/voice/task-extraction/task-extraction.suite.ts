import { loadJson, renderMessages, type Golden, type PromptMessage } from '../../lib/golden';
import { taskSchema } from '../../lib/schemas';
import { defineTextSuite } from '../../lib/suite';

const promptUrl = new URL('./system-prompt.json', import.meta.url);
const casesUrl = new URL('./expected-cases.json', import.meta.url);
const prompt = await loadJson<PromptMessage[]>(promptUrl);

export default await defineTextSuite({
  name: 'voice-task-extraction',
  description: 'Voice transcripts become tasks with urgency and resolved due dates',
  tier: 'capability',
  cases: await loadJson<Golden[]>(casesUrl),
  datasetFiles: [casesUrl],
  promptFiles: [promptUrl],
  messages: (golden) =>
    renderMessages(prompt, {
      referenceDateTime: String(golden.additionalMetadata?.referenceDateTime),
      transcript: golden.input,
    }),
  schema: taskSchema,
  rubric: [
    'Compare actual output to the reference semantically, ignoring harmless title wording changes.',
    'Require every actionable item, correct urgency, and correctly resolved due dates including the noon default.',
    'Penalize invented tasks, priority, dates, omissions, splitting, and combining.',
  ].join('\n'),
});
