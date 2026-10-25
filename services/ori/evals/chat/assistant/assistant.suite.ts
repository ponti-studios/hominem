import {
  currentUtcDate,
  loadJson,
  renderMessages,
  type CriteriaGolden,
  type PromptMessage,
} from '../../lib/golden';
import { defineTextSuite } from '../../lib/suite';

const promptUrl = new URL('./system-prompt.json', import.meta.url);
const casesUrl = new URL('./expected-cases.json', import.meta.url);
/** The model chat ships with (`CHAT_MODEL` in packages/env). Keep in step with it. */
const chatModel = process.env.ORI_TARGET_MODEL?.trim() || 'openai/gpt-6-luna';
const prompt = await loadJson<PromptMessage[]>(promptUrl);

export default await defineTextSuite({
  name: 'chat-assistant',
  description: 'The Omiro chat assistant answers directly, calmly and accurately',
  tier: 'capability',
  model: chatModel,
  cases: await loadJson<CriteriaGolden[]>(casesUrl),
  datasetFiles: [casesUrl],
  promptFiles: [promptUrl],
  messages: (golden) =>
    renderMessages(prompt, { user_message: golden.input, current_date: currentUtcDate() }),
  rubric: [
    'You are grading one reply from a private personal assistant. There is no single correct wording, so grade against the criteria below, not against a model answer.',
    'Do not judge by length, format, or style. A longer or differently worded reply passes if it satisfies every criterion.',
    'Fail the reply if it mocks, shames, patronizes, or uses sarcasm, if it invents capabilities or facts, or if it contains an error that would materially mislead the user. Do not fail it for small incidental details.',
  ].join('\n'),
});
