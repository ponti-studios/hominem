import { expect, test } from 'bun:test';

import { pilotCases, setupAgent } from 'ori/eval';

import chatHarness from './lib/chat-harness';
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
const BATCH_SIZE = 3;

test('chat baseline', async () => {
  const failures: Error[] = [];
  const sampledCases = pilotCases(cases);
  const batches = Array.from({ length: Math.ceil(sampledCases.length / BATCH_SIZE) }, (_, index) =>
    sampledCases.slice(index * BATCH_SIZE, index * BATCH_SIZE + BATCH_SIZE),
  );

  for (const batch of batches) {
    const settled = await Promise.allSettled(
      batch.map(async (golden) => {
        const input = renderMessages(prompt, {
          user_message: golden.input,
          current_date: currentUtcDate(),
        });
        const run = await agent.run(input);
        if (!run.text.trim()) throw new Error('Chat baseline returned an empty response');
        if (run.text.length > 1_000) {
          throw new Error(`Chat baseline response is unexpectedly long (${run.text.length} chars)`);
        }
        run.toComplete();
        run.toFinishWithin(120_000);
      }),
    );

    for (const result of settled) {
      if (result.status === 'rejected') {
        failures.push(
          result.reason instanceof Error ? result.reason : new Error(String(result.reason)),
        );
      }
    }
  }

  expect(failures).toEqual([]);
});
