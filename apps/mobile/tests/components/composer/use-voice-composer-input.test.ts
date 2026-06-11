import { describe, expect, it } from 'vitest';

import {
  mergeTranscriptIntoDraft,
  replaceTranscriptInDraft,
} from '~/components/composer/voiceComposerInput.helpers';

describe('voice composer input helpers', () => {
  it('appends a transcript on a new line when the draft already has content', () => {
    expect(mergeTranscriptIntoDraft('Existing draft', 'raw transcript')).toBe(
      'Existing draft\nraw transcript',
    );
  });

  it('replaces only the inserted transcript suffix with cleaned text', () => {
    expect(
      replaceTranscriptInDraft(
        'Existing draft\nraw transcript',
        'raw transcript',
        'Raw transcript.',
      ),
    ).toBe('Existing draft\nRaw transcript.');
  });

  it('leaves the draft alone when the expected transcript suffix is missing', () => {
    expect(replaceTranscriptInDraft('Edited by user', 'raw transcript', 'Raw transcript.')).toBe(
      'Edited by user',
    );
  });
});
