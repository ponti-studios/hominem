import { expect, test } from 'bun:test';

import { canExecute, requestConfirmation, resolveConfirmation, scoreMcpTrace } from './mcp-scoring';

test('scores independent reads without requiring an exact sequence', () => {
  const score = scoreMcpTrace(
    { toolCalls: ['career_profile', 'trip_history'], text: 'Tokyo and Staff Engineer' },
    {
      requiredTools: ['trip_history', 'career_profile'],
      dependencies: [],
      outputIncludes: ['Tokyo', 'Staff Engineer'],
    },
  );
  expect(score.passed).toEqual(true);
});

test('scores dependency and forbidden-tool failures separately', () => {
  const score = scoreMcpTrace(
    { toolCalls: ['finance_recent_transactions', 'trip_history'] },
    {
      requiredTools: ['trip_history', 'finance_recent_transactions'],
      forbiddenTools: ['place_visit_history'],
      dependencies: [['trip_history', 'finance_recent_transactions']],
    },
  );
  expect(score.passed).toEqual(false);
  expect(score.dependencies.violated).toEqual(['trip_history -> finance_recent_transactions']);
  expect(score.forbiddenTools.found).toEqual([]);
  expect(score.failureCategory).toEqual('planning');
});

test('fails an overall scenario when arguments or results miss', () => {
  const score = scoreMcpTrace(
    {
      toolCalls: ['trip_history', 'finance_recent_transactions'],
      calls: [
        {
          tool: 'finance_recent_transactions',
          input: { from: '2025-04-10', to: '2025-04-18' },
          output: { transactions: [{ merchant: 'Bento Box' }] },
          status: 'succeeded',
        },
      ],
      text: 'Tokyo and Sushi Dai',
    },
    {
      requiredTools: ['trip_history', 'finance_recent_transactions'],
      argumentAssertions: [
        { tool: 'finance_recent_transactions', matches: { from: '2025-04-10', to: '2025-04-19' } },
      ],
      resultAssertions: [{ tool: 'finance_recent_transactions', outputIncludes: ['Sushi Dai'] }],
    },
  );

  expect(score.passed).toEqual(false);
  expect(score.arguments).toEqual({ passed: false, failed: ['finance_recent_transactions'] });
  expect(score.results).toEqual({ passed: false, failed: ['finance_recent_transactions'] });
  expect(score.failureCategory).toEqual('planning');
});

test('matches required argument subsets and repeated calls by occurrence', () => {
  const score = scoreMcpTrace(
    {
      toolCalls: ['finance_recent_transactions', 'trip_history', 'finance_recent_transactions'],
      calls: [
        {
          tool: 'finance_recent_transactions',
          input: { from: '2025-04-10', to: '2025-04-19' },
          output: { transactions: [{ merchant: 'Bento Box' }] },
          status: 'succeeded',
        },
        {
          tool: 'finance_recent_transactions',
          input: { to: '2025-04-18', from: '2025-04-10', limit: 10 },
          output: { transactions: [{ merchant: 'Sushi Dai' }] },
          status: 'succeeded',
        },
      ],
      text: 'Tokyo and Sushi Dai',
    },
    {
      requiredTools: ['trip_history', 'finance_recent_transactions'],
      dependencies: [['trip_history', 'finance_recent_transactions']],
      argumentAssertions: [
        { tool: 'finance_recent_transactions', matches: { from: '2025-04-10', to: '2025-04-18' } },
      ],
      resultAssertions: [{ tool: 'finance_recent_transactions', outputIncludes: ['Sushi Dai'] }],
    },
  );

  expect(score.passed).toEqual(true);
  expect(score.dependencies).toEqual({ passed: true, violated: [] });
  expect(score.arguments).toEqual({ passed: true, failed: [] });
  expect(score.results).toEqual({ passed: true, failed: [] });
});

test('compares exact arguments without depending on key order', () => {
  const score = scoreMcpTrace(
    {
      toolCalls: ['people_lookup'],
      calls: [{ tool: 'people_lookup', input: { query: 'Alex' }, status: 'succeeded' }],
      text: 'Alex',
    },
    {
      argumentAssertions: [{ tool: 'people_lookup', equals: { query: 'Alex' } }],
    },
  );

  expect(score.arguments).toEqual({ passed: true, failed: [] });
});

test('confirmation cannot execute dependent writes before approval', () => {
  const input = { collectionId: 'collection-japan', entityId: 'person-alex' };
  const pending = requestConfirmation({ status: 'ready' }, 'remove_collection_item', input);
  expect(canExecute(pending, 'remove_collection_item', input)).toEqual(false);
  const rejected = resolveConfirmation(pending, 'reject');
  expect(canExecute(rejected, 'remove_collection_item', input)).toEqual(false);
  const approved = resolveConfirmation(pending, 'approve');
  expect(canExecute(approved, 'remove_collection_item', input)).toEqual(true);
  expect(
    canExecute(approved, 'remove_collection_item', {
      ...input,
      entityId: 'invented-entity',
    }),
  ).toEqual(false);
});
