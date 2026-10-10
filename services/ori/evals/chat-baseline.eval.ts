import { expect, test } from 'bun:test';

import { pilotCases, setupAgent } from 'ori/eval';

import chatHarness from './lib/chat-harness';
import { withEvaluationRetry } from './lib/eval-infra';
import {
  loadJson,
  renderMessages,
  currentUtcDate,
  targetModel,
  type Golden,
  type PromptMessage,
} from './lib/evaluator';

const prompt = await loadJson<PromptMessage[]>(
  new URL('../data/chat-assistant/prompt.json', import.meta.url),
);
const cases = await loadJson<Golden[]>(
  new URL('../data/chat-assistant/goldens.json', import.meta.url),
);

const agent = setupAgent({ model: targetModel, harness: chatHarness });

test('chat baseline', async () => {
  const failures: Error[] = [];

  for (const golden of pilotCases(cases)) {
    try {
      await withEvaluationRetry(async () => {
        const input = renderMessages(prompt, {
          user_message: golden.input,
          current_date: currentUtcDate(),
        });
        const run = await agent.run(input);
        // This suite captures baseline latency and usage; it does not grade prose style.
        if (!run.text.trim()) throw new Error('Chat baseline returned an empty response');
        run.toComplete();
        run.toFinishWithin(120_000);
      });
    } catch (error) {
      failures.push(error instanceof Error ? error : new Error(String(error)));
    }
  }

  expect(failures).toEqual([]);
}, 300_000);
