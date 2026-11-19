import { assertions, type AssertionValueFunctionContext } from 'promptfoo';

import { judgeModel } from '../lib/golden';
import { scoreMcpTrace, type McpExpectation, type McpTrace } from '../lib/mcp-scoring';

/**
 * Grades an agent run in two stages inside ONE assertion, so the judge is only paid for when
 * the deterministic trajectory already passed (separate promptfoo assertions run concurrently).
 *
 * 1. Trajectory: which tools ran, in what order, with which arguments, whether the agent
 *    stopped at the confirmation boundary, and what the answer contains.
 * 2. Judge (only when the case has a rubric): the answer against the rubric, shown the tool
 *    results the agent actually got so "grounded in the tool output" is checkable.
 */
export default async function mcpGrade(output: string, context: AssertionValueFunctionContext) {
  const trace = context.providerResponse?.metadata?.trace as McpTrace | undefined;
  if (!trace) return fail('trajectory', 'provider recorded no trace');
  const toolPath = trace.toolCalls.join(' -> ') || '(none)';

  const score = scoreMcpTrace(trace, context.vars.expected as McpExpectation);
  if (!score.passed) {
    const failed = Object.entries(score)
      .filter(
        ([, value]) => typeof value === 'object' && value && 'passed' in value && !value.passed,
      )
      .map(([name, value]) => `${name}: ${JSON.stringify(value)}`);
    return fail('trajectory', `${failed.join('; ')} | tools: ${toolPath}`);
  }

  const rubric = String(context.vars.rubric ?? '');
  if (!rubric) {
    return {
      pass: true,
      score: 1,
      reason: `tools: ${toolPath}`,
      componentResults: [component('trajectory', true, 1, `tools: ${toolPath}`)],
    };
  }

  const results = JSON.stringify(
    trace.calls?.map(({ tool, input, output: result }) => ({ tool, input, output: result })) ?? [],
  );
  const minScore = Number(context.config?.minScore ?? 0.7);
  const grade = await assertions.matchesLlmRubric(
    `${rubric}\n\nAuthoritative tool results for this run (the candidate must use only these facts):\n${results}`,
    output,
    { provider: `openrouter:${judgeModel}` },
  );
  const pass = grade.score >= minScore;
  return {
    pass,
    score: grade.score,
    reason: grade.reason,
    componentResults: [
      component('trajectory', true, 1, `tools: ${toolPath}`),
      component('judge', pass, grade.score, grade.reason),
    ],
  };
}

const component = (metric: string, pass: boolean, score: number, reason: string) => ({
  pass,
  score,
  reason,
  assertion: { type: 'javascript' as const, metric },
});

const fail = (metric: string, reason: string) => ({
  pass: false,
  score: 0,
  reason,
  componentResults: [component(metric, false, 0, reason)],
});
