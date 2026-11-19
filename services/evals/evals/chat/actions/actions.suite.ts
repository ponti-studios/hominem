import {
  chatModel,
  currentUtcDateLabel,
  loadJson,
  renderMessages,
  type CriteriaGolden,
  type PromptMessage,
} from '../../lib/golden';
import { defineTextSuite } from '../../lib/suite';

const promptUrl = new URL('./system-prompt.json', import.meta.url);
const casesUrl = new URL('./expected-cases.json', import.meta.url);
const prompt = await loadJson<PromptMessage[]>(promptUrl);

export default await defineTextSuite({
  name: 'chat-actions',
  description:
    'The Omiro chat assistant reaches for the right tool when the user states something to do or remember',
  tier: 'capability',
  toolNames: [
    'task_create',
    'task_list',
    'task_delete',
    'remember',
    'search_memories',
    'list_memories',
  ],
  model: chatModel,
  cases: await loadJson<CriteriaGolden[]>(casesUrl),
  datasetFiles: [casesUrl],
  promptFiles: [promptUrl],
  messages: (golden) =>
    renderMessages(prompt, { user_message: golden.input, current_date: currentUtcDateLabel() }),
  rubric: [
    'You are grading the first step of a private personal assistant. It was offered tools, and the reply is the tool call it made (or a plain reply, if it made none).',
    'Today is {{currentDate}} (UTC). Judge dates against it.',
    'There is no model answer. Grade against the criteria below: the right tool, sensible arguments, and no asking permission or announcing an action instead of taking it.',
  ].join('\n'),
});
