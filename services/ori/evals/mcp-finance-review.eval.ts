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
  expected: Omit<McpExpectation, 'requiredTools' | 'allowedTools'> & {
    tools?: string[];
    allowedTools?: string[];
  };
  rubric: string;
};

const benchmark = await loadJson<{ version: string; scenarios: Scenario[] }>(
  new URL('../data/mcp-finance-review/benchmark.json', import.meta.url),
);
const agent = setupAgent({ model: targetModel, harness: mcpHarness });
const judge = setupJudge({ agent: setupAgent({ model: judgeModel }), minScore: 0.7 });
const BATCH_SIZE = 3;
const SUITE_TIMEOUT_MS = 900_000;

test(
  `MCP finance review ${benchmark.version}`,
  async () => {
    const failures: Error[] = [];
    const batches = Array.from(
      { length: Math.ceil(benchmark.scenarios.length / BATCH_SIZE) },
      (_, index) => benchmark.scenarios.slice(index * BATCH_SIZE, index * BATCH_SIZE + BATCH_SIZE),
    );

    for (const batch of batches) {
      const settled = await Promise.allSettled(
        batch.map(async (scenario) => {
          const prompt = buildFinanceReviewPromptText(scenario.month);
          const run = await agent.run({ prompt });
          run.toFinishWithin(120_000);
          const trace = getLastMcpTrace(prompt);
          const score = scoreMcpTrace(
            { ...trace, toolCalls: run.toolCalls, text: run.text },
            {
              ...scenario.expected,
              requiredTools: scenario.expected.tools,
              allowedTools: scenario.expected.allowedTools ?? scenario.expected.tools ?? [],
            },
          );
          if (!score.passed) {
            throw new Error(
              `score=${JSON.stringify(score)} calls=${JSON.stringify(run.toolCalls)}`,
            );
          }
          run.toComplete();
          const toolResults = (trace.calls ?? []).map(({ tool, input, output }) => ({
            tool,
            input,
            output,
          }));
          await judge.autoEvals({
            criteria: `${scenario.rubric}\n\nAuthoritative tool results for this run (the candidate must use only these values):\n${JSON.stringify(toolResults)}`,
            prompt,
            run,
          });
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
