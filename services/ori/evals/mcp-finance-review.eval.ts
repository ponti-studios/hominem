import { expect, test } from 'bun:test';

import { setupAgent, setupJudge } from 'ori/eval';

import { judgeModel, loadJson, targetModel } from './lib/evaluator';
import mcpHarness, { getLastMcpTrace } from './lib/mcp-harness';
import { scoreMcpTrace, type McpExpectation } from './lib/mcp-scoring';

type Scenario = {
  id: string;
  category: string;
  prompt: string;
  expected: McpExpectation;
  rubric: string;
};

const benchmark = await loadJson<{ version: string; scenarios: Scenario[] }>(
  new URL('../data/mcp-finance-review/benchmark.json', import.meta.url),
);
const agent = setupAgent({ model: targetModel, harness: mcpHarness });
const judge = setupJudge({ agent: setupAgent({ model: judgeModel }), minScore: 0.7 });

test(`MCP finance review ${benchmark.version}`, async () => {
  const failures: Error[] = [];
  for (const scenario of benchmark.scenarios) {
    try {
      const run = await agent.run({
        prompt: scenario.prompt,
        systemPrompt:
          'You are a personal finance assistant. For the requested calendar month, call finance_monthly_stats with month as YYYY-MM, finance_spending_by_category with the first and last day as from and to, and finance_top_merchants with those same dates. If the month is missing, ask which month before calling any finance tools. Report income, expenses, net, transaction count, largest categories, and top merchants using only returned values. Keep currencies separate; never combine amounts from different currencies. When currencyCode is null, do not assign amounts to a currency; for top merchants report names without amounts. Preserve warnings. This workflow is read-only: never call finance write tools.',
      });
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
        prompt: scenario.prompt,
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
});
