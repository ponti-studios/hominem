
import { deriveMobileComposerPresentation } from '../../components/input/mobile-composer-config'

describe('mobile composer presentation', () => {
  it('returns inbox capture defaults', () => {
    expect(
      deriveMobileComposerPresentation({
        context: 'inbox',
        hasText: false,
        isRecording: false,
      }),
    ).toEqual({
      placeholder: 'Write a note, ask something, or drop a file',
      primaryActionLabel: 'Save note',
      secondaryActionLabel: 'Start chat',
      showsAttachmentButton: true,
      showsVoiceButton: true,
      posture: 'capture',
    })
  })

  it('returns hidden posture for note context (note detail has its own editor)', () => {
    expect(
      deriveMobileComposerPresentation({
        context: 'note',
        hasText: true,
        isRecording: false,
      }),
    ).toEqual({
      placeholder: '',
      primaryActionLabel: '',
      secondaryActionLabel: null,
      showsAttachmentButton: false,
      showsVoiceButton: false,
      posture: 'hidden',
    })
  })

  it('returns hidden posture for chat context (chat screen has its own composer)', () => {
    expect(
      deriveMobileComposerPresentation({
        context: 'chat',
        hasText: true,
        isRecording: false,
      }),
    ).toEqual({
      placeholder: '',
      primaryActionLabel: '',
      secondaryActionLabel: null,
      showsAttachmentButton: false,
      showsVoiceButton: false,
      posture: 'hidden',
    })
  })

  it('returns search posture without create actions', () => {
    expect(
      deriveMobileComposerPresentation({
        context: 'search',
        hasText: false,
        isRecording: false,
      }),
    ).toEqual({
      placeholder: 'Search notes, chats, and files',
      primaryActionLabel: 'Search',
      secondaryActionLabel: null,
      showsAttachmentButton: false,
      showsVoiceButton: false,
      posture: 'search',
    })
  })
})
