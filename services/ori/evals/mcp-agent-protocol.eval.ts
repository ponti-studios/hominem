import { expect, test } from 'bun:test';

import {
  canExecute,
  requestConfirmation,
  resolveConfirmation,
  scoreMcpTrace,
} from './lib/mcp-scoring';

type ProtocolFixture = {
  name: string;
  trace: Parameters<typeof scoreMcpTrace>[0];
  expected: Parameters<typeof scoreMcpTrace>[1];
};

const fixtures: ProtocolFixture[] = [
  {
    name: 'trip dates are prerequisites for finance',
    trace: { toolCalls: ['trip_history', 'finance_recent_transactions'], text: 'Sushi Dai' },
    expected: {
      requiredTools: ['trip_history', 'finance_recent_transactions'],
      dependencies: [['trip_history', 'finance_recent_transactions']],
      outputIncludes: ['Sushi Dai'],
    },
  },
  {
    name: 'confirmation boundary is terminal until approval',
    trace: {
      toolCalls: ['list_collections', 'people_lookup', 'invite_member'],
      confirmationRequested: 'invite_member',
    },
    expected: {
      requiredTools: ['list_collections', 'people_lookup', 'invite_member'],
      dependencies: [
        ['list_collections', 'invite_member'],
        ['people_lookup', 'invite_member'],
      ],
      stopBefore: 'invite_member',
    },
  },
];

for (const fixture of fixtures) {
  test(`agent protocol: ${fixture.name}`, () => {
    expect(scoreMcpTrace(fixture.trace, fixture.expected).passed).toEqual(true);
  });
}

test('agent protocol blocks a rejected confirmation from executing', () => {
  const pending = requestConfirmation({ status: 'ready' }, 'invite_member', {
    collectionId: 'collection-japan',
    email: 'alex@example.com',
  });
  const rejected = resolveConfirmation(pending, 'reject');
  expect(
    canExecute(rejected, 'invite_member', {
      collectionId: 'collection-japan',
      email: 'alex@example.com',
    }),
  ).toEqual(false);
});
