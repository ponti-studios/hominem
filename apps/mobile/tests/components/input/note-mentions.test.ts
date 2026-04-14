import { describe, expect, it } from 'vitest';

import {
  getTrailingMentionQuery,
  removeTrailingMentionQuery,
} from '~/components/composer/note-mentions';

describe('note mention helpers', () => {
  it('detects a trailing mention slug', () => {
    expect(getTrailingMentionQuery('Ask about #project-plan')).toBe('project-plan');
  });

  it('ignores non-trailing mentions', () => {
    expect(getTrailingMentionQuery('Ask about #project-plan tomorrow')).toBeNull();
  });

  it('ignores a bare # token', () => {
    expect(getTrailingMentionQuery('Ask about #')).toBeNull();
  });

  it('ignores invalid mention characters', () => {
    expect(getTrailingMentionQuery('Ask about #project!')).toBeNull();
  });

  it('removes only the trailing mention token', () => {
    expect(removeTrailingMentionQuery('Ask about #project-plan')).toBe('Ask about');
    expect(removeTrailingMentionQuery('#project-plan')).toBe('');
    expect(removeTrailingMentionQuery('Ask about #project-plan tomorrow')).toBe(
      'Ask about #project-plan tomorrow',
    );
  });
});
