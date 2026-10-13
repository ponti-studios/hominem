import { test } from 'bun:test';

import { pilotCases, setupAgent } from 'ori/eval';

import { withEvaluationRetry } from './lib/eval-infra';
import { loadJson, targetModel, type Golden } from './lib/evaluator';
import mcpHarness from './lib/mcp-harness';
import { scoreMcpTrace } from './lib/mcp-scoring';

type McpGolden = Golden & {
  expectedTools: Array<{ name: string }>;
  expectedOutputIncludes?: string[];
};
const cases = await loadJson<McpGolden[]>(
  new URL('../data/mcp-tool-selection/goldens.json', import.meta.url),
);
const sampledCases = pilotCases(cases);
const agent = setupAgent({ model: targetModel, harness: mcpHarness });

for (const golden of sampledCases) {
  test(`MCP tool selection: ${golden.name ?? golden.input}`, async () => {
    await withEvaluationRetry(async () => {
      const run = await agent.run({
        prompt: golden.input,
        systemPrompt:
          'Use the available Hominem tools when they are needed. Complete the request concisely.',
      });
      const expectedTools = golden.expectedTools.map((tool) => tool.name);
      const score = scoreMcpTrace(
        { toolCalls: run.toolCalls, text: run.text },
        {
          requiredTools: expectedTools,
          outputIncludes: golden.expectedOutputIncludes,
        },
      );
      if (!score.passed) {
        throw new Error(`score=${JSON.stringify(score)} calls=${JSON.stringify(run.toolCalls)}`);
      }
      run.toComplete();
      for (const expectedText of golden.expectedOutputIncludes ?? []) {
        if (!run.text.includes(expectedText)) {
          throw new Error(`response did not include ${JSON.stringify(expectedText)}`);
        }
      }
    });
  }, 180_000);
}
