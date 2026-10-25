import { useRouter } from 'expo-router';
import { useCallback } from 'react';

import { setActiveEnhanceSession } from '~/services/ai/active-enhance-session';

import type { ComposerEntryKind, ComposerProps } from './composer.types';
import {
  deriveComposerContentCapabilities,
  type ComposerCapabilitiesVoiceInput,
} from './composerCapabilities.helpers';
import { getComposerSubmissionConfig } from './composerSubmission.helpers';
import type { ComposerMessageStore } from './useComposerMessageStore';
import { useComposerMessageStore } from './useComposerMessageStore';

interface UseComposerActionsInput {
  composerProps: ComposerProps;
  messageStore: ComposerMessageStore;
  entryMode: 'mixed' | ComposerEntryKind;
  manualEntryKind: ComposerEntryKind | null;
  uploadedAttachmentCount: number;
  state: {
    isFocused: boolean;
    isInteractionBusy: boolean;
    showAttachments: boolean;
  };
  voice: ComposerCapabilitiesVoiceInput;
  onChangeMessage: (message: string) => void;
}

// What the tray and the trailing action both need to agree on: whether there is
// anything to send, what the current entry kind is, and which actions are
// allowed. Subscribes to the message store, so only the components that call
// it re-render while typing (see useComposerMessageStore.ts).
export function useComposerActions({
  composerProps,
  messageStore,
  entryMode,
  manualEntryKind,
  uploadedAttachmentCount,
  state,
  voice,
  onChangeMessage,
}: UseComposerActionsInput) {
  const router = useRouter();
  // Mixed mode defaults to note and only changes via the explicit
  // ComposerKindToggle -- typing plain text should never flip it to chat.
  const selectedEntryKind = manualEntryKind ?? (entryMode === 'mixed' ? 'note' : entryMode);
  const hasContent =
    useComposerMessageStore(messageStore, (value) => value.trim().length > 0) ||
    uploadedAttachmentCount > 0;
  const { canSubmit, canOpenEnhance } = deriveComposerContentCapabilities({
    hasContent,
    isFocused: state.isFocused,
    showAttachments: state.showAttachments,
    isInteractionBusy: state.isInteractionBusy,
    voice,
  });
  const presentation = getComposerSubmissionConfig(composerProps, selectedEntryKind);

  const openEnhance = useCallback(() => {
    setActiveEnhanceSession({ getMessage: messageStore.getMessage, setMessage: onChangeMessage });
    router.push('/enhance-sheet');
  }, [messageStore.getMessage, onChangeMessage, router]);

  return { canOpenEnhance, canSubmit, hasContent, openEnhance, presentation, selectedEntryKind };
}
