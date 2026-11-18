import { expect, test } from 'vitest';

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

test('rejects tool calls outside an explicit allow-list', () => {
  const score = scoreMcpTrace(
    { toolCalls: ['trip_history', 'finance_recent_transactions', 'people_lookup'] },
    {
      requiredTools: ['trip_history', 'finance_recent_transactions'],
      allowedTools: ['trip_history', 'finance_recent_transactions'],
    },
  );

  expect(score.passed).toEqual(false);
  expect(score.allowedTools).toEqual({ passed: false, unexpected: ['people_lookup'] });
  expect(score.failureCategory).toEqual('planning');
});

test('accepts a no-tool response when the allow-list is empty', () => {
  const score = scoreMcpTrace(
    { toolCalls: [], text: 'Which month should I review?' },
    {
      allowedTools: [],
      outputIncludes: ['Which month'],
    },
  );

  expect(score.passed).toEqual(true);
});

test('checks tool arguments against the observed call trace', () => {
  const score = scoreMcpTrace(
    {
      toolCalls: ['finance_recent_transactions'],
      calls: [
        {
          tool: 'finance_recent_transactions',
          input: { from: '2025-04-10', to: '2025-04-19' },
          status: 'succeeded',
        },
      ],
    },
    {
      allowedTools: ['finance_recent_transactions'],
      argumentAssertions: [
        {
          tool: 'finance_recent_transactions',
          equals: { from: '2025-04-10', to: '2025-04-18' },
        },
      ],
    },
  );

  expect(score.passed).toEqual(false);
  expect(score.arguments.failed).toEqual(['finance_recent_transactions']);
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

test('fails a run that ran out of turns, even when the calls it made were right', () => {
  const score = scoreMcpTrace(
    { toolCalls: ['search_tools', 'trip_history'], truncated: true },
    { requiredTools: ['trip_history'] },
  );
  expect(score.passed).toEqual(false);
  expect(score.completed).toEqual({ passed: false });
  expect(score.failureCategory).toEqual('planning');
});

test('fails a run whose required tool errored and was never retried successfully', () => {
  const score = scoreMcpTrace(
    {
      toolCalls: ['note_create'],
      calls: [{ tool: 'note_create', input: {}, error: 'failed', status: 'failed' }],
      text: 'Sorry, that did not save, but I noted it.',
    },
    { requiredTools: ['note_create'] },
  );
  expect(score.passed).toEqual(false);
  expect(score.executions).toEqual({ passed: false, failed: ['note_create'] });
  expect(score.failureCategory).toEqual('planning');
});

test('keeps a run passing when a failed tool attempt was recovered by a later success', () => {
  const score = scoreMcpTrace(
    {
      toolCalls: ['note_create', 'note_create'],
      calls: [
        { tool: 'note_create', input: {}, error: 'failed', status: 'failed' },
        { tool: 'note_create', input: {}, output: { ok: true }, status: 'succeeded' },
      ],
    },
    { requiredTools: ['note_create'] },
  );
  expect(score.passed).toEqual(true);
  expect(score.executions.passed).toEqual(true);
});
