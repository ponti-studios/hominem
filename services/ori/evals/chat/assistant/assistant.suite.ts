import {
  currentUtcDate,
  loadJson,
  renderMessages,
  type Golden,
  type PromptMessage,
} from '../../lib/golden';
import { defineTextSuite, fileAssertion } from '../../lib/suite';

const promptUrl = new URL('./system-prompt.json', import.meta.url);
const casesUrl = new URL('./expected-cases.json', import.meta.url);
const prompt = await loadJson<PromptMessage[]>(promptUrl);

export default await defineTextSuite({
  name: 'chat-assistant',
  description: 'The Omiro chat assistant answers directly, calmly and briefly',
  tier: 'capability',
  cases: await loadJson<Golden[]>(casesUrl),
  datasetFiles: [casesUrl],
  promptFiles: [promptUrl],
  messages: (golden) =>
    renderMessages(prompt, { user_message: golden.input, current_date: currentUtcDate() }),
  assertions: [fileAssertion('concise.ts', { maxChars: 400 }, 'concise')],
  rubric: [
    'Use the expected output below as the authoritative reference for the answer’s conclusion and essential reasoning.',
    'The response should be calm, respectful, direct, and grounded; it must not mock, shame, patronize, or use sarcasm.',
    'For an ordinary request, answer in one or two concise sentences with the conclusion first and the essential reason second.',
    'Treat material omissions, invented claims, generic reassurance, hedging, or padding as failures even when the general topic is correct.',
  ].join('\n'),
});
