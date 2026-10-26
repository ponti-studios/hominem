import { loadJson, renderMessages, type Golden, type PromptMessage } from '../../lib/golden';
import { taskSchema } from '../../lib/schemas';
import { defineTextSuite } from '../../lib/suite';

const promptUrl = new URL('./system-prompt.json', import.meta.url);
const casesUrl = new URL('./expected-cases.json', import.meta.url);
const prompt = await loadJson<PromptMessage[]>(promptUrl);

export default await defineTextSuite({
  name: 'task-extraction',
  description: 'Conversations become actionable tasks, nothing invented',
  tier: 'capability',
  cases: await loadJson<Golden[]>(casesUrl),
  datasetFiles: [casesUrl],
  promptFiles: [promptUrl],
  messages: (golden) => renderMessages(prompt, { conversation: golden.input }),
  schema: taskSchema,
  judgeSeesInput: true,
  rubric: [
    'Compare the JSON output to the reference output semantically, ignoring harmless title wording changes.',
    'Require every actionable commitment and forbid vague thoughts or invented tasks.',
    'Penalize missing, combined, split, or materially incorrect tasks.',
    'A title may carry a deadline or detail the user stated in the conversation; penalize only details that appear nowhere in it.',
  ].join('\n'),
});
