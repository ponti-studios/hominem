import { describe, expect, it } from 'vitest';

import { resolveInitialComposerMessage } from '~/components/composer/composer-initial-message';

describe('resolveInitialComposerMessage', () => {
  it('uses a non-empty persisted draft before a route seed', () => {
    expect(
      resolveInitialComposerMessage({
        initialDraft: 'Saved draft',
        seedMessage: 'Route seed',
      }),
    ).toBe('Saved draft');
  });

  it('uses the route seed when the persisted draft is empty', () => {
    expect(
      resolveInitialComposerMessage({
        initialDraft: '',
        seedMessage: 'Route seed',
      }),
    ).toBe('Route seed');
  });
});
