import { expect, test } from 'bun:test';

import { setupAgent } from 'ori/eval';

import { loadJson, targetModel } from './lib/evaluator';
import mcpHarness, { getLastMcpTrace } from './lib/mcp-harness';
import { scoreMcpTrace, type McpExpectation } from './lib/mcp-scoring';

type Scenario = {
  id: string;
  category: string;
  prompt: string;
  expected: {
    tools?: string[];
    forbiddenTools?: string[];
    dependencies?: [string, string][];
    stopBefore?: string;
    confirmation?: boolean;
    outputIncludes?: string[];
    argumentAssertions?: { tool: string; equals: Record<string, unknown> }[];
    resultAssertions?: { tool: string; outputIncludes?: string[]; error?: string }[];
    outcome?: string;
  };
};

const benchmark = await loadJson<{ version: string; scenarios: Scenario[] }>(
  new URL('../data/mcp-tool-selection/benchmark.v2.json', import.meta.url),
);
const agent = setupAgent({ model: targetModel, harness: mcpHarness });
const BATCH_SIZE = 3;
const SUITE_TIMEOUT_MS = 900_000;

test(
  `MCP capability planning ${benchmark.version}`,
  async () => {
    const failures: Error[] = [];
    const batches = Array.from(
      { length: Math.ceil(benchmark.scenarios.length / BATCH_SIZE) },
      (_, index) => benchmark.scenarios.slice(index * BATCH_SIZE, index * BATCH_SIZE + BATCH_SIZE),
    );

    for (const batch of batches) {
      const settled = await Promise.allSettled(
        batch.map(async (scenario) => {
          const run = await agent.run({
            prompt: scenario.prompt,
            systemPrompt:
              'You are testing a capability-first personal agent. Use the narrowest tools, preserve IDs and dates from results, search before writes, and stop at confirmation-required actions.',
          });
          const trace = getLastMcpTrace(scenario.prompt);
          const score = scoreMcpTrace({ ...trace, toolCalls: run.toolCalls, text: run.text }, {
            requiredTools: scenario.expected.tools,
            forbiddenTools: scenario.expected.forbiddenTools,
            dependencies: scenario.expected.dependencies,
            stopBefore: scenario.expected.stopBefore,
            confirmation: scenario.expected.confirmation,
            outputIncludes: scenario.expected.outputIncludes,
            argumentAssertions: scenario.expected.argumentAssertions,
            resultAssertions: scenario.expected.resultAssertions,
          } satisfies McpExpectation);
          if (!score.passed) {
            throw new Error(
              `score=${JSON.stringify(score)} calls=${JSON.stringify(run.toolCalls)}`,
            );
          }
          run.toComplete();
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
  },
  SUITE_TIMEOUT_MS,
);
