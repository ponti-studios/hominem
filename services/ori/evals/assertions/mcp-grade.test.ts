import type { AssertionValueFunctionContext } from 'promptfoo';
import { expect, test } from 'vitest';

import mcpGrade from './mcp-grade';

const context = (trace: unknown, rubric = 'be right'): AssertionValueFunctionContext =>
  ({
    providerResponse: { metadata: { trace } },
    vars: { expected: { requiredTools: ['list_collections'] }, rubric },
    config: {},
  }) as unknown as AssertionValueFunctionContext;

test('no trace fails without a judge call', async () => {
  const result = await mcpGrade('hi', context(undefined));
  expect(result.pass).toEqual(false);
  expect(result.componentResults[0]?.assertion.metric).toEqual('trajectory');
});

test('a trajectory failure never reaches the judge', async () => {
  // No network is available in tests: reaching the judge would throw.
  const result = await mcpGrade(
    'hi',
    context({ toolCalls: [], calls: [], finalText: 'hi', confirmationRequested: false }),
  );
  expect(result.pass).toEqual(false);
  expect(result.componentResults.map((c) => c.assertion.metric)).toEqual(['trajectory']);
});
