import { describe, expect, it } from 'vitest';

import {
  createTopAnchoredInboxState,
  markTopRevealHandled,
  requestTopReveal,
  shouldRevealTop,
} from '~/services/inbox/top-anchored-inbox';

describe('top anchored inbox', () => {
  it('reveals the top once after a focused request', () => {
    const requestedState = requestTopReveal(createTopAnchoredInboxState());

    expect(
      shouldRevealTop({
        state: requestedState,
        headKey: 'note:1',
        isFocused: true,
      }),
    ).toBe(true);

    const handledState = markTopRevealHandled(requestedState);

    expect(
      shouldRevealTop({
        state: handledState,
        headKey: 'note:1',
        isFocused: true,
      }),
    ).toBe(false);
  });

  it('waits until focus returns before revealing the top', () => {
    const state = requestTopReveal(createTopAnchoredInboxState());

    expect(
      shouldRevealTop({
        state,
        headKey: 'note:1',
        isFocused: false,
      }),
    ).toBe(false);

    expect(
      shouldRevealTop({
        state,
        headKey: 'note:1',
        isFocused: true,
      }),
    ).toBe(true);
  });

  it('does not reveal the top without a pending request', () => {
    expect(
      shouldRevealTop({
        state: createTopAnchoredInboxState(),
        headKey: 'note:1',
        isFocused: true,
      }),
    ).toBe(false);
  });

  it('does not reveal the top when there is no head item', () => {
    const state = requestTopReveal(createTopAnchoredInboxState());

    expect(
      shouldRevealTop({
        state,
        headKey: null,
        isFocused: true,
      }),
    ).toBe(false);
  });
});
