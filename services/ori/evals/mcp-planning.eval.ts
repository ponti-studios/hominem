import { test } from 'bun:test';

import { setupAgent } from 'ori/eval';

import { withEvaluationRetry } from './lib/eval-infra';
import { loadJson, targetModel } from './lib/evaluator';
import mcpHarness, { getLastMcpTrace } from './lib/mcp-harness';
import { scoreMcpTrace, type McpArgumentAssertion, type McpExpectation } from './lib/mcp-scoring';

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
    argumentAssertions?: McpArgumentAssertion[];
    resultAssertions?: { tool: string; outputIncludes?: string[]; error?: string }[];
    outcome?: string;
  };
};

const benchmark = await loadJson<{ version: string; scenarios: Scenario[] }>(
  new URL('../data/mcp-tool-selection/benchmark.v2.json', import.meta.url),
);
const agent = setupAgent({ model: targetModel, harness: mcpHarness });

for (const scenario of benchmark.scenarios) {
  test(`MCP capability planning ${benchmark.version}: ${scenario.id}`, async () => {
    try {
      await withEvaluationRetry(async () => {
        const run = await agent.run({
          prompt: scenario.prompt,
          systemPrompt:
            'You are testing a capability-first personal agent. Use the narrowest tools, preserve IDs and dates from results, search before writes, and stop at confirmation-required actions.',
        });
        const trace = getLastMcpTrace();
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
          throw new Error(`score=${JSON.stringify(score)} calls=${JSON.stringify(run.toolCalls)}`);
        }
        run.toComplete();
      });
    } catch (error) {
      throw new Error(
        `${scenario.id} (${scenario.category}): ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }, 180_000);
}
