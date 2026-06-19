import { spacing } from '@hominem/ui/tokens';
import React from 'react';
import { View } from 'react-native';

import { makeStyles } from '~/components/theme';
import { ActionButton } from '~/components/composer/ComposerButtons';
import { ComposerMedia } from '~/components/composer/ComposerMedia';
import t from '~/translations';

interface ComposerToolbarProps {
  mode: 'feed' | 'chat';
  isRecording: boolean;
  isVoiceBusy: boolean;
  isEnhancing: boolean;
  isCleaningVoice: boolean;
  canSubmit: boolean;
  isSubmitting: boolean;
  onVoicePress: () => void;
  onEnhancePress: () => void;
  onSubmit: () => void;
  onStartChat?: () => void;
}

export function ComposerToolbar({
  mode,
  isRecording,
  isVoiceBusy,
  isEnhancing,
  isCleaningVoice,
  canSubmit,
  isSubmitting,
  onVoicePress,
  onEnhancePress,
  onSubmit,
  onStartChat,
}: ComposerToolbarProps) {
  const styles = useStyles();
  const busy = isSubmitting || isVoiceBusy || isEnhancing;

  return (
    <View style={styles.toolbar}>
      <View style={styles.leading}>
        <ComposerMedia
          accessibilityLabel={t.feed.composer.addAttachmentA11y}
          disabled={isSubmitting}
        />
      </View>
      <View style={styles.trailing}>
        <ActionButton
          icon={isRecording ? 'stop.fill' : 'mic.fill'}
          onPress={onVoicePress}
          accessibilityLabel={
            isRecording
              ? t.feed.composer.stopVoiceInputA11y
              : t.feed.composer.startVoiceInputA11y
          }
          disabled={busy && !isRecording}
          isAnimating={isVoiceBusy}
        />
        <ActionButton
          icon="wand.and.sparkles"
          onPress={onEnhancePress}
          accessibilityLabel={t.feed.composer.enhanceTextA11y}
          disabled={!canSubmit || busy}
          isAnimating={isEnhancing || isCleaningVoice}
        />
        {mode === 'feed' && onStartChat ? (
          <ActionButton
            icon="bubble.left"
            onPress={onStartChat}
            accessibilityLabel={t.feed.composer.openChatA11y}
            disabled={!canSubmit || busy}
          />
        ) : null}
        <ActionButton
          icon="arrow.up"
          onPress={onSubmit}
          accessibilityLabel={
            mode === 'feed'
              ? t.feed.composer.saveNoteA11y
              : isSubmitting
                ? t.chat.input.sendingA11y
                : t.chat.input.sendMessageA11y
          }
          disabled={!canSubmit || busy}
        />
      </View>
    </View>
  );
}

const useStyles = makeStyles(() => ({
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: spacing[6],
  },
  leading: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  trailing: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    borderRadius: 32,
    paddingHorizontal: spacing[1],
  },
}));
