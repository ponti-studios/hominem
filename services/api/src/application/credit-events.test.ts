import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock('@hominem/db/core', () => ({ pool: { query: mocks.query, options: {} } }));

import {
  CREDIT_EVENTS_CHANNEL,
  deliverCreditNotification,
  publishCreditEvent,
  subscribeCreditEvents,
} from './credit-events';

beforeEach(() => vi.clearAllMocks());

describe('credit events', () => {
  it('publishes a content-free notice for the person', async () => {
    await publishCreditEvent('u1', 'credited');
    expect(mocks.query).toHaveBeenCalledWith('select pg_notify($1, $2)', [
      CREDIT_EVENTS_CHANNEL,
      JSON.stringify({ userId: 'u1', outcome: 'credited' }),
    ]);
  });

  it('hands a notification only to that person’s connections', () => {
    const mine = vi.fn();
    const mineToo = vi.fn();
    const theirs = vi.fn();
    subscribeCreditEvents('u1', mine);
    subscribeCreditEvents('u1', mineToo);
    subscribeCreditEvents('u2', theirs);
    deliverCreditNotification(JSON.stringify({ userId: 'u1', outcome: 'not_charged' }));
    expect(mine).toHaveBeenCalledWith('not_charged');
    expect(mineToo).toHaveBeenCalledWith('not_charged');
    expect(theirs).not.toHaveBeenCalled();
  });

  it('stops delivering after a connection unsubscribes', () => {
    const listener = vi.fn();
    const stop = subscribeCreditEvents('u3', listener);
    stop();
    deliverCreditNotification(JSON.stringify({ userId: 'u3', outcome: 'credited' }));
    expect(listener).not.toHaveBeenCalled();
  });

  it('ignores a malformed or unexpected notification', () => {
    const listener = vi.fn();
    subscribeCreditEvents('u4', listener);
    for (const payload of [
      undefined,
      '',
      'not json',
      '{}',
      JSON.stringify({ userId: 'u4', outcome: 'other' }),
    ]) {
      deliverCreditNotification(payload);
    }
    expect(listener).not.toHaveBeenCalled();
  });
});
