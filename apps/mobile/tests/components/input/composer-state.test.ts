import { describe, expect, it } from 'vitest';

import {
  createEmptyComposerDraft,
  deriveMobileComposerPresentation,
  resolveComposerTarget,
} from '~/components/input/composer-state';

describe('resolveComposerTarget', () => {
  it('resolves top-level feed routes', () => {
    expect(resolveComposerTarget('/(protected)/(tabs)/')).toEqual({
      kind: 'feed',
      key: 'feed',
      chatId: null,
      noteId: null,
    });
  });

  it('resolves note and chat detail routes', () => {
    expect(resolveComposerTarget('/(protected)/(tabs)/notes/123')).toEqual({
      kind: 'note',
      key: 'note:123',
      chatId: null,
      noteId: '123',
    });

    expect(resolveComposerTarget('/(protected)/(tabs)/chat/abc')).toEqual({
      kind: 'chat',
      key: 'chat:abc',
      chatId: 'abc',
      noteId: null,
    });
  });

  it('hides the composer on settings screens', () => {
    expect(resolveComposerTarget('/(protected)/(tabs)/settings')).toEqual({
      kind: 'hidden',
      key: 'hidden',
      chatId: null,
      noteId: null,
    });
  });
});

describe('deriveMobileComposerPresentation', () => {
  it('hides the composer for hidden targets', () => {
    expect(
      deriveMobileComposerPresentation(
        { kind: 'hidden', key: 'hidden', chatId: null, noteId: null },
        false,
        false,
      ),
    ).toMatchObject({
      isHidden: true,
      showsAttachmentButton: false,
      showsVoiceButton: false,
    });
  });

  it('adapts the primary action for a note target', () => {
    expect(
      deriveMobileComposerPresentation(
        { kind: 'note', key: 'note:1', chatId: null, noteId: '1' },
        true,
        false,
      ),
    ).toMatchObject({
      primaryActionLabel: 'Append',
      isCompact: true,
      showsNoteChips: false,
    });
  });
});

describe('createEmptyComposerDraft', () => {
  it('returns a fresh draft object', () => {
    expect(createEmptyComposerDraft()).toEqual({
      text: '',
      attachments: [],
      isRecording: false,
      mode: 'text',
      selectedNoteIds: [],
    });
  });
});
