import {
  currentUtcDate,
  loadJson,
  renderMessages,
  type Golden,
  type PromptMessage,
} from '../../lib/golden';
import { defineTextSuite } from '../../lib/suite';

const promptUrl = new URL('./system-prompt.json', import.meta.url);
const casesUrl = new URL('./expected-cases.json', import.meta.url);
const prompt = await loadJson<PromptMessage[]>(promptUrl);

export default await defineTextSuite({
  name: 'chat-assistant',
  description: 'The Omiro chat assistant answers directly, calmly and accurately',
  tier: 'capability',
  cases: await loadJson<Golden[]>(casesUrl),
  datasetFiles: [casesUrl],
  promptFiles: [promptUrl],
  messages: (golden) =>
    renderMessages(prompt, { user_message: golden.input, current_date: currentUtcDate() }),
  rubric: [
    'Use the expected output below as the authoritative reference for the answer’s conclusion and essential reasoning.',
    'The response should be calm, respectful, direct, and grounded; it must not mock, shame, patronize, or use sarcasm.',
    'Lead with the conclusion and give the essential reason. Do not judge the answer by its length: extra detail is fine as long as it is accurate and the conclusion matches the reference.',
    'Treat material omissions, invented claims, generic reassurance, or hedging that avoids a conclusion as failures even when the general topic is correct.',
  ].join('\n'),
});
