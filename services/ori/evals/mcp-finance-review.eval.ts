import { expect, test } from 'bun:test';

import { setupAgent, setupJudge } from 'ori/eval';

import { buildFinanceReviewPromptText } from '../../api/src/mcp/prompts/finance-review-content';
import { judgeModel, loadJson, targetModel } from './lib/evaluator';
import mcpHarness, { getLastMcpTrace } from './lib/mcp-harness';
import { scoreMcpTrace, type McpExpectation } from './lib/mcp-scoring';

type Scenario = {
  id: string;
  category: string;
  month?: string;
  expected: McpExpectation;
  rubric: string;
};

const benchmark = await loadJson<{ version: string; scenarios: Scenario[] }>(
  new URL('../data/mcp-finance-review/benchmark.json', import.meta.url),
);
const agent = setupAgent({ model: targetModel, harness: mcpHarness });
const judge = setupJudge({ agent: setupAgent({ model: judgeModel }), minScore: 0.7 });
const SUITE_TIMEOUT_MS = 900_000;

test(
  `MCP finance review ${benchmark.version}`,
  async () => {
    const failures: Error[] = [];
    for (const scenario of benchmark.scenarios) {
      try {
        const run = await agent.run({
          prompt: buildFinanceReviewPromptText(scenario.month),
        });
        run.toFinishWithin(120_000);
        const trace = getLastMcpTrace();
        const score = scoreMcpTrace(
          { ...trace, toolCalls: run.toolCalls, text: run.text },
          scenario.expected,
        );
        if (!score.passed) {
          throw new Error(`score=${JSON.stringify(score)} calls=${JSON.stringify(run.toolCalls)}`);
        }
        run.toComplete();
        const toolResults = (trace.calls ?? []).map(({ tool, input, output }) => ({
          tool,
          input,
          output,
        }));
        await judge.autoEvals({
          criteria: `${scenario.rubric}\n\nAuthoritative tool results for this run (the candidate must use only these values):\n${JSON.stringify(toolResults)}`,
          prompt: buildFinanceReviewPromptText(scenario.month),
          run,
        });
      } catch (error) {
        failures.push(
          new Error(
            `${scenario.id} (${scenario.category}): ${error instanceof Error ? error.message : String(error)}`,
          ),
        );
      }
    }
    expect(failures).toEqual([]);
  },
  SUITE_TIMEOUT_MS,
);
