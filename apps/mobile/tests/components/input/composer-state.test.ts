import { describe, expect, it } from 'vitest';

import {
  createEmptyComposerDraft,
  deriveComposerPresentation,
  resolveComposerTarget,
} from '~/components/composer/composerState';

describe('resolveComposerTarget', () => {
  it('resolves top-level feed routes', () => {
    expect(resolveComposerTarget('/(protected)/(tabs)/')).toEqual({
      kind: 'feed',
      key: 'feed',
      chatId: null,
      noteId: null,
    });
  });

  it('resolves chat detail routes and hides on note detail routes', () => {
    expect(resolveComposerTarget('/(protected)/(tabs)/notes/123')).toEqual({
      kind: 'hidden',
      key: 'hidden',
      chatId: null,
      noteId: null,
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

describe('deriveComposerPresentation', () => {
  it('hides the composer for hidden targets', () => {
    expect(
      deriveComposerPresentation(
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
