import { describe, expect, it } from 'vitest';

import {
  createTopAnchoredFeedState,
  markTopRevealHandled,
  requestTopReveal,
  shouldRevealTop,
} from '~/services/inbox/top-anchored-feed';

describe('top anchored feed', () => {
  it('reveals the top once after a focused request', () => {
    const requestedState = requestTopReveal(createTopAnchoredFeedState());

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
    const state = requestTopReveal(createTopAnchoredFeedState());

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
        state: createTopAnchoredFeedState(),
        headKey: 'note:1',
        isFocused: true,
      }),
    ).toBe(false);
  });

  it('does not reveal the top when there is no head item', () => {
    const state = requestTopReveal(createTopAnchoredFeedState());

    expect(
      shouldRevealTop({
        state,
        headKey: null,
        isFocused: true,
      }),
    ).toBe(false);
  });
});
