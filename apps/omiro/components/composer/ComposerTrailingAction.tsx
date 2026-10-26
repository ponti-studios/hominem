import { memo } from 'react';

import { useAppTheme } from '~/components/theme';
import { IconButton } from '~/components/ui';
import AppIcon from '~/components/ui/icon';
import t from '~/translations';

import type { ComposerEntryKind, ComposerProps, ComposerSubmitKind } from './composer.types';
import type { ComposerCapabilitiesVoiceInput } from './composerCapabilities.helpers';
import { ComposerSendButton } from './ComposerSendButton';
import { useComposerActions } from './useComposerActions';
import type { ComposerMessageStore } from './useComposerMessageStore';

const ACTION_SIZE = 40;

interface ComposerTrailingActionProps {
  composerProps: ComposerProps;
  messageStore: ComposerMessageStore;
  entryMode: 'mixed' | ComposerEntryKind;
  manualEntryKind: ComposerEntryKind | null;
  uploadedAttachmentCount: number;
  state: {
    isFocused: boolean;
    isInteractionBusy: boolean;
    isSubmitting: boolean;
    showAttachments: boolean;
  };
  canToggleVoice: boolean;
  voice: ComposerCapabilitiesVoiceInput & {
    handleVoicePress: () => void | Promise<void>;
  };
  onChangeMessage: (message: string) => void;
  onSubmit: (kind: ComposerSubmitKind, message: string, canSubmit: boolean) => void;
}

// The pill's one trailing control: mic while there is nothing to send, the lime
// send button once there is. Subscribes to the message store separately from
// ComposerInput, so typing re-renders each independently instead of the whole
// composer (see useComposerMessageStore.ts).
function ComposerTrailingActionComponent({
  composerProps,
  messageStore,
  entryMode,
  manualEntryKind,
  uploadedAttachmentCount,
  state,
  canToggleVoice,
  voice,
  onChangeMessage,
  onSubmit,
}: ComposerTrailingActionProps) {
  const { barForeground } = useAppTheme().colors;
  const { canSubmit, hasContent, presentation } = useComposerActions({
    composerProps,
    messageStore,
    entryMode,
    manualEntryKind,
    uploadedAttachmentCount,
    state,
    voice,
    onChangeMessage,
  });

  const generation = composerProps.mode === 'chat' ? composerProps.generation : undefined;
  if (generation) {
    return (
      <ComposerSendButton
        accessibilityLabel={t.chat.generation.stopA11y}
        disabled={generation.isStopping}
        icon="stop.fill"
        size={ACTION_SIZE}
        testID="chat-generation-stop"
        tone="lime"
        onPress={generation.onCancel}
      />
    );
  }

  if (!hasContent) {
    return (
      <IconButton
        accessibilityLabel={
          voice.isRecordingElsewhere
            ? t.inboxComposer.composer.recordingElsewhereA11y
            : t.inboxComposer.composer.startVoiceInputA11y
        }
        disabled={!canToggleVoice}
        style={{ width: ACTION_SIZE, height: ACTION_SIZE }}
        testID="composer-mic-button"
        variant="plain"
        onPress={() => {
          void voice.handleVoicePress();
        }}
      >
        <AppIcon name="mic.fill" size={20} tintColor={barForeground} />
      </IconButton>
    );
  }

  return (
    <ComposerSendButton
      accessibilityLabel={
        presentation.submitAccessibilityLabel ??
        (state.isSubmitting ? t.chat.input.sendingA11y : t.chat.input.sendMessageA11y)
      }
      disabled={!canSubmit}
      icon="arrow.up"
      isLoading={state.isSubmitting}
      size={ACTION_SIZE}
      testID={presentation.submitTestID}
      tone="lime"
      onPress={() => onSubmit(presentation.primarySubmitKind, messageStore.getMessage(), canSubmit)}
    />
  );
}

export const ComposerTrailingAction = memo(ComposerTrailingActionComponent);
