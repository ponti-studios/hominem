import {
  createEmptyComposerDraft,
  deriveMobileComposerPresentation,
  resolveComposerTarget,
} from '../../components/input/input-context'

describe('mobile composer routing helpers', () => {
  it('resolves the feed target by default', () => {
    expect(resolveComposerTarget('/')).toEqual({
      kind: 'feed',
      key: 'feed',
      chatId: null,
      noteId: null,
    })
  })

  it('resolves chat and note targets from route params', () => {
    expect(
      resolveComposerTarget('/(protected)/(tabs)/chat/chat-1', {
        id: 'chat-1',
      }),
    ).toEqual({
      kind: 'chat',
      key: 'chat:chat-1',
      chatId: 'chat-1',
      noteId: null,
    })

    expect(
      resolveComposerTarget('/(protected)/(tabs)/notes/note-1', {
        id: 'note-1',
      }),
    ).toEqual({
      kind: 'note',
      key: 'note:note-1',
      chatId: null,
      noteId: 'note-1',
    })

    expect(resolveComposerTarget('/(protected)/(tabs)/notes')).toEqual({
      kind: 'notes',
      key: 'notes',
      chatId: null,
      noteId: null,
    })
  })

  it('hides the composer on settings routes', () => {
    expect(resolveComposerTarget('/(protected)/(tabs)/settings')).toEqual({
      kind: 'hidden',
      key: 'hidden',
      chatId: null,
      noteId: null,
    })
  })

  it('derives presentation for feed, chat, note, and hidden routes', () => {
    const feed = deriveMobileComposerPresentation(
      resolveComposerTarget('/'),
      false,
      false,
    )
    const chat = deriveMobileComposerPresentation(
      resolveComposerTarget('/(protected)/(tabs)/chat/chat-1', { id: 'chat-1' }),
      true,
      false,
    )
    const note = deriveMobileComposerPresentation(
      resolveComposerTarget('/(protected)/(tabs)/notes/note-1', { id: 'note-1' }),
      true,
      false,
    )
    const notes = deriveMobileComposerPresentation(resolveComposerTarget('/(protected)/(tabs)/notes'), true, false)
    const hidden = deriveMobileComposerPresentation(
      resolveComposerTarget('/(protected)/(tabs)/settings'),
      false,
      false,
    )

    expect(feed).toMatchObject({
      primaryActionLabel: 'Save note',
      secondaryActionLabel: 'Start chat',
      showsNoteChips: false,
      isHidden: false,
    })
    expect(chat).toMatchObject({
      primaryActionLabel: 'Send',
      secondaryActionLabel: null,
      showsNoteChips: true,
      isHidden: false,
    })
    expect(note).toMatchObject({
      primaryActionLabel: 'Append',
      secondaryActionLabel: null,
      isCompact: true,
      isHidden: false,
    })
    expect(notes).toMatchObject({
      primaryActionLabel: 'Save note',
      secondaryActionLabel: null,
      isCompact: false,
      isHidden: false,
    })
    expect(hidden.isHidden).toBe(true)
  })

  it('creates empty drafts with isolated note-chip selection state', () => {
    expect(createEmptyComposerDraft()).toEqual({
      text: '',
      attachments: [],
      isRecording: false,
      mode: 'text',
      selectedNoteIds: [],
    })
  })
})
