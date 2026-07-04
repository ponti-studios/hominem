import { describe, expect, it } from 'vitest';

import {
  createVoiceComposerError,
  deriveVoiceComposerState,
  mergeTranscriptIntoDraft,
  maybeApplyCleanedTranscript,
  replaceTranscriptInDraft,
} from '~/components/composer/voiceComposerInput.helpers';

describe('voice composer input helpers', () => {
  it('derives a recording state while the recorder is active', () => {
    expect(
      deriveVoiceComposerState({
        isRecording: true,
        isTranscribing: false,
        isCleaningVoice: false,
        error: null,
      }),
    ).toBe('recording');
  });

  it('derives a transcribing state after recording stops and before cleanup starts', () => {
    expect(
      deriveVoiceComposerState({
        isRecording: false,
        isTranscribing: true,
        isCleaningVoice: false,
        error: null,
      }),
    ).toBe('transcribing');
  });

  it('derives a cleaning state while cleanup is running', () => {
    expect(
      deriveVoiceComposerState({
        isRecording: false,
        isTranscribing: false,
        isCleaningVoice: true,
        error: null,
      }),
    ).toBe('cleaning');
  });

  it('derives a failed state when transcription fails', () => {
    expect(
      deriveVoiceComposerState({
        isRecording: false,
        isTranscribing: false,
        isCleaningVoice: false,
        error: createVoiceComposerError('transcription-failed'),
      }),
    ).toBe('failed');
  });

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

  it('ignores cleanup when the draft changed after raw transcript insertion', () => {
    expect(
      maybeApplyCleanedTranscript({
        currentDraft: 'Edited by user',
        insertedDraft: 'Existing draft\nraw transcript',
        rawText: 'raw transcript',
        cleanedText: 'Raw transcript.',
        changed: true,
      }),
    ).toBe('Edited by user');
  });

  it('applies cleanup when the inserted draft is still current', () => {
    expect(
      maybeApplyCleanedTranscript({
        currentDraft: 'Existing draft\nraw transcript',
        insertedDraft: 'Existing draft\nraw transcript',
        rawText: 'raw transcript',
        cleanedText: 'Raw transcript.',
        changed: true,
      }),
    ).toBe('Existing draft\nRaw transcript.');
  });

  it('leaves the draft alone when the expected transcript suffix is missing', () => {
    expect(replaceTranscriptInDraft('Edited by user', 'raw transcript', 'Raw transcript.')).toBe(
      'Edited by user',
    );
  });
});
