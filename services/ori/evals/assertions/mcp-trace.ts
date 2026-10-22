import type { AssertionValueFunctionContext } from 'promptfoo';

import { scoreMcpTrace, type McpExpectation, type McpTrace } from '../lib/mcp-scoring';

/**
 * Deterministic trajectory grader: which tools ran, in what order, with which arguments,
 * whether the agent stopped at the confirmation boundary, and what the answer contains.
 */
export default function mcpTrace(_output: string, context: AssertionValueFunctionContext) {
  const trace = context.providerResponse?.metadata?.trace as McpTrace | undefined;
  if (!trace) return { pass: false, score: 0, reason: 'provider recorded no trace' };
  const score = scoreMcpTrace(trace, context.vars.expected as McpExpectation);
  const failed = Object.entries(score)
    .filter(([, value]) => typeof value === 'object' && value && 'passed' in value && !value.passed)
    .map(([name, value]) => `${name}: ${JSON.stringify(value)}`);
  return {
    pass: score.passed,
    score: score.passed ? 1 : 0,
    reason: score.passed
      ? `tools: ${trace.toolCalls.join(' -> ') || '(none)'}`
      : `${failed.join('; ')} | tools: ${trace.toolCalls.join(' -> ') || '(none)'}`,
  };
}
