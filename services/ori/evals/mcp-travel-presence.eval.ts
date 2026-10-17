import { expect, test } from 'bun:test';

import { setupAgent, setupJudge } from 'ori/eval';

import { judgeModel, loadJson, targetModel } from './lib/evaluator';
import mcpHarness, { getLastMcpTrace } from './lib/mcp-harness';
import { scoreMcpTrace } from './lib/mcp-scoring';

type Scenario = {
  name: string;
  category: string;
  promptVersion: string;
  input: string;
  expectedOutput: string;
  expectedTools: Array<{ name: string }>;
  expectedOutputIncludes: string[];
};

const scenarios = await loadJson<Scenario[]>(
  new URL('../data/mcp-travel-presence/goldens.json', import.meta.url),
);
const agent = setupAgent({ model: targetModel, harness: mcpHarness });
const judge = setupJudge({ agent: setupAgent({ model: judgeModel }), minScore: 0.7 });

test('MCP travel presence evidence', async () => {
  const failures: Error[] = [];
  for (const scenario of scenarios) {
    try {
      const run = await agent.run({
        prompt: scenario.input,
        systemPrompt:
          'Use travel_countries for country and place-presence questions. Treat stop, layover, visit, and residence as distinct evidence; one place can have multiple types. When asked about a layover, explicitly distinguish the airport layover from a destination stop.',
      });
      run.toFinishWithin(120_000);
      const trace = getLastMcpTrace(scenario.input);
      const score = scoreMcpTrace(
        { ...trace, toolCalls: run.toolCalls, text: run.text },
        {
          requiredTools: scenario.expectedTools.map(({ name }) => name),
          allowedTools: scenario.expectedTools.map(({ name }) => name),
          outputIncludes: scenario.expectedOutputIncludes,
        },
      );
      if (!score.passed) {
        throw new Error(
          `${scenario.name}: score=${JSON.stringify(score)} calls=${JSON.stringify(run.toolCalls)} output=${run.text}`,
        );
      }
      run.toComplete();
      await judge.autoEvals({
        criteria: `${scenario.expectedOutput}\n\nAuthoritative tool results (use only these facts):\n${JSON.stringify(trace.calls?.map(({ tool, output }) => ({ tool, output })) ?? [])}`,
        prompt: scenario.input,
        run,
      });
    } catch (error) {
      failures.push(error instanceof Error ? error : new Error(String(error)));
    }
  }
  expect(failures).toEqual([]);
}, 900_000);
