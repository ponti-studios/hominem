import { assertions, type AssertionValueFunctionContext } from 'promptfoo';

import type { McpTrace } from '../lib/mcp-scoring';

const JUDGE_PROVIDER = process.env.ORI_JUDGE_MODEL?.trim() || 'openai/gpt-6-luna';

/**
 * Judge for agent answers. It sees the tool results the agent actually got, so "grounded in
 * the tool output" is checkable. Runs only after the deterministic trace grader (see suite.ts).
 */
export default async function mcpJudge(output: string, context: AssertionValueFunctionContext) {
  const trace = context.providerResponse?.metadata?.trace as McpTrace | undefined;
  const results = JSON.stringify(
    trace?.calls?.map(({ tool, input, output: result }) => ({ tool, input, output: result })) ?? [],
  );
  const minScore = Number(context.config?.minScore ?? 0.7);
  const rubric = `${String(context.vars.rubric)}\n\nAuthoritative tool results for this run (the candidate must use only these facts):\n${results}`;
  const grade = await assertions.matchesLlmRubric(rubric, output, {
    provider: `openrouter:${JUDGE_PROVIDER}`,
  });
  return { ...grade, pass: grade.score >= minScore, metric: 'judge' };
}
