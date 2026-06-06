import { describe, expect, it } from 'vitest';

import { getApplicationNoteTone } from '../applicationNoteUtils';

describe('applicationNoteUtils', () => {
  it('returns specialized tones for note types', () => {
    expect(getApplicationNoteTone('interview')).toBe(
      'border-accent/30 bg-accent/10 text-foreground',
    );
    expect(getApplicationNoteTone('research')).toBe('border-accent/30 bg-accent/10 text-primary');
    expect(getApplicationNoteTone('follow_up')).toBe(
      'border-warning/30 bg-warning/10 text-foreground',
    );
  });

  it('falls back to the default note tone', () => {
    expect(getApplicationNoteTone('general')).toBe('border-border bg-muted text-muted-foreground');
  });
});
