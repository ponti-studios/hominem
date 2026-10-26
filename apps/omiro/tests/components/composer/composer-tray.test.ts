import { describe, expect, it } from 'vitest';

import { shouldShowComposerTray } from '~/components/composer/composerCapabilities.helpers';

describe('shouldShowComposerTray', () => {
  it('hides at rest', () => {
    expect(
      shouldShowComposerTray({ isFocused: false, hasContent: false, showAttachments: false }),
    ).toBe(false);
  });

  it.each([
    { isFocused: true, hasContent: false, showAttachments: false },
    { isFocused: false, hasContent: true, showAttachments: false },
    { isFocused: false, hasContent: false, showAttachments: true },
  ])('shows while writing: %o', (input) => {
    expect(shouldShowComposerTray(input)).toBe(true);
  });
});
