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

test('confirmation cannot execute dependent writes before approval', () => {
  const input = { collectionId: 'collection-japan', entityId: 'person-alex' };
  const pending = requestConfirmation({ status: 'ready' }, 'remove_collection_item', input);
  expect(canExecute(pending, 'remove_collection_item')).toEqual(false);
  const rejected = resolveConfirmation(pending, 'reject');
  expect(canExecute(rejected, 'remove_collection_item')).toEqual(false);
  const approved = resolveConfirmation(pending, 'approve');
  expect(canExecute(approved, 'remove_collection_item')).toEqual(true);
});
