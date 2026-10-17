import { expect, test } from 'bun:test';

import { setupAgent, setupJudge } from 'ori/eval';

import type { McpFixtureProfile } from './mcp-fixtures';
import { runMcpCase } from './mcp-harness';
import { scoreMcpTrace, type McpExpectation } from './mcp-scoring';

type McpCaseResult = Awaited<ReturnType<typeof runMcpCase>>;

type BuiltMcpCase = {
  prompt: string;
  systemPrompt?: string;
  tools: readonly string[];
  fixture?: McpFixtureProfile;
  expected: McpExpectation;
};

type McpSuiteOptions<Scenario> = {
  name: string;
  model: string;
  scenarios: readonly Scenario[];
  buildCase: (scenario: Scenario) => BuiltMcpCase;
  judge?: {
    model: string;
    minScore: number;
    criteria: (scenario: Scenario, result: McpCaseResult) => string;
  };
  batchSize?: number;
  timeoutMs?: number;
  onPass?: (scenario: Scenario, result: McpCaseResult) => void | Promise<void>;
};

export function registerMcpSuite<Scenario>({
  name,
  model,
  scenarios,
  buildCase,
  judge,
  batchSize = 3,
  timeoutMs = 900_000,
  onPass,
}: McpSuiteOptions<Scenario>): void {
  const evaluator = judge
    ? setupJudge({ agent: setupAgent({ model: judge.model }), minScore: judge.minScore })
    : undefined;

  test(
    name,
    async () => {
      const failures: Error[] = [];
      const batches = Array.from({ length: Math.ceil(scenarios.length / batchSize) }, (_, index) =>
        scenarios.slice(index * batchSize, (index + 1) * batchSize),
      );

      for (const batch of batches) {
        const settled = await Promise.allSettled(
          batch.map(async (scenario) => {
            const built = buildCase(scenario);
            const result = await runMcpCase({ model, ...built });
            result.run.toFinishWithin(120_000);
            result.run.toComplete();
            const score = scoreMcpTrace(
              { ...result.trace, toolCalls: result.run.toolCalls, text: result.run.text },
              built.expected,
            );
            if (!score.passed) {
              throw new Error(
                `${JSON.stringify(score)} calls=${JSON.stringify(result.run.toolCalls)} trace=${JSON.stringify(result.trace.calls)} text=${result.run.text}`,
              );
            }
            await onPass?.(scenario, result);
            if (evaluator && judge) {
              await evaluator.autoEvals({
                criteria: judge.criteria(scenario, result),
                prompt: built.prompt,
                run: result.run,
              });
            }
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
    timeoutMs,
  );
}
