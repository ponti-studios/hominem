/**
 * Composer presentation derivation
 *
 * Web equivalent of mobile's deriveMobileComposerPresentation.
 * Posture + copy + button visibility are derived from the route-based
 * ComposerMode — no component state required.
 *
 * Posture:
 *   capture   — home/focus route (create note or start chat)
 *   reply     — chat detail (reply to conversation)
 *   hidden    — any route where the composer should not render
 */

import type { ComposerMode } from './composer-provider';

export type ComposerPosture = 'capture' | 'draft' | 'reply' | 'note-query' | 'hidden';
export type ComposerActionIcon = 'plus.circle' | 'arrow.up' | 'bubble.left';
export type ComposerSubmitIntent =
  | 'send-reply'
  | 'save-note'
  | 'save-as-note'
  | 'start-chat';

export interface ComposerActionSpec {
  intent: ComposerSubmitIntent;
  label: string;
  /** Icon name understood by the Composer — kept symbolic so the component picks the icon */
  icon: ComposerActionIcon;
}

export interface ComposerPresentation {
  posture: ComposerPosture;
  placeholder: string;
  primaryAction: ComposerActionSpec;
  secondaryAction: ComposerActionSpec | null;
  showsAttachmentButton: boolean;
  showsVoiceButton: boolean;
  showsNotePicker: boolean;
}

export function deriveComposerPresentation(
  mode: ComposerMode,
  isRecording = false,
): ComposerPresentation {
  if (mode === 'note-aware') {
    return {
      posture: 'note-query',
      placeholder: 'Ask about this note…',
      primaryAction: {
        intent: 'start-chat',
        label: 'Ask',
        icon: 'arrow.up',
      },
      secondaryAction: null,
      showsAttachmentButton: false,
      showsVoiceButton: true,
      showsNotePicker: false,
    };
  }

  if (mode === 'chat-continuation') {
    return {
      posture: 'reply',
      placeholder: isRecording ? 'Listening…' : 'Reply in chat',
      primaryAction: {
        intent: 'send-reply',
        label: 'Send',
        icon: 'arrow.up',
      },
      secondaryAction: {
        intent: 'save-as-note',
        label: 'Save as note',
        icon: 'plus.circle',
      },
      showsAttachmentButton: true,
      showsVoiceButton: true,
      showsNotePicker: true,
    };
  }

  // generic — home / focus route
  return {
    posture: 'capture',
    placeholder: isRecording ? 'Listening…' : 'Write a note, ask something, or drop a file',
    primaryAction: {
      intent: 'save-note',
      label: 'Save note',
      icon: 'plus.circle',
    },
    secondaryAction: {
      intent: 'start-chat',
      label: 'Start chat',
      icon: 'bubble.left',
    },
    showsAttachmentButton: true,
    showsVoiceButton: true,
    showsNotePicker: false,
  };
}
