import { spacing } from '@hominem/ui/tokens';
import type { SFSymbol } from 'expo-symbols';
import React from 'react';
import { View } from 'react-native';
import Reanimated, { LinearTransition, SlideInRight, SlideOutRight } from 'react-native-reanimated';

import { ActionButton } from '~/components/composer/ComposerButtons';
import { ComposerMedia } from '~/components/composer/ComposerMedia';
import { makeStyles } from '~/components/theme';
import t from '~/translations';

interface ComposerToolbarProps {
  mode: 'inbox' | 'chat';
  isRecording: boolean;
  isVoiceBusy: boolean;
  isEnhancing: boolean;
  isCleaningVoice: boolean;
  canPickMedia: boolean;
  canToggleVoice: boolean;
  canEnhance: boolean;
  canSubmit: boolean;
  isSubmitting: boolean;
  onVoicePress: () => void;
  onEnhancePress: () => void;
  onSubmit: () => void;
  submitTestID?: string;
  submitAccessibilityLabel?: string;
  secondaryAction?: {
    accessibilityLabel: string;
    icon: SFSymbol;
    onPress: () => void;
    testID?: string;
  };
}

const buttonEnter = SlideInRight.duration(180);
const buttonExit = SlideOutRight.duration(150);
const pillLayout = LinearTransition.duration(180);

export function ComposerToolbar({
  mode,
  isRecording,
  isVoiceBusy,
  isEnhancing,
  isCleaningVoice,
  canPickMedia,
  canToggleVoice,
  canEnhance,
  canSubmit,
  isSubmitting,
  onVoicePress,
  onEnhancePress,
  onSubmit,
  submitTestID,
  submitAccessibilityLabel,
  secondaryAction,
}: ComposerToolbarProps) {
  const styles = useStyles();

  return (
    <View style={styles.toolbar}>
      <View style={styles.leading}>
        <ComposerMedia
          accessibilityLabel={t.inboxComposer.composer.addAttachmentA11y}
          disabled={!canPickMedia}
        />
      </View>
      <Reanimated.View style={styles.trailing} layout={pillLayout}>
        <ActionButton
          icon={isRecording ? 'stop.fill' : 'mic.fill'}
          onPress={onVoicePress}
          accessibilityLabel={
            isRecording ? t.inboxComposer.composer.stopVoiceInputA11y : t.inboxComposer.composer.startVoiceInputA11y
          }
          disabled={!canToggleVoice}
          isAnimating={isVoiceBusy}
        />
        {canSubmit ? (
          <Reanimated.View entering={buttonEnter} exiting={buttonExit}>
            <ActionButton
              icon="wand.and.sparkles"
              onPress={onEnhancePress}
              accessibilityLabel={t.inboxComposer.composer.enhanceTextA11y}
              disabled={!canEnhance}
              isAnimating={isEnhancing || isCleaningVoice}
            />
          </Reanimated.View>
        ) : null}
        {mode === 'inbox' && secondaryAction && canSubmit ? (
          <Reanimated.View entering={buttonEnter} exiting={buttonExit} style={styles.secondarySlot}>
            <ActionButton
              icon={secondaryAction.icon}
              onPress={secondaryAction.onPress}
              accessibilityLabel={secondaryAction.accessibilityLabel}
              testID={secondaryAction.testID}
              disabled={isSubmitting || !canSubmit}
              variant="muted"
            />
          </Reanimated.View>
        ) : null}
        {canSubmit ? (
          <Reanimated.View entering={buttonEnter} exiting={buttonExit}>
            <ActionButton
              icon="arrow.up"
              onPress={onSubmit}
              accessibilityLabel={
                submitAccessibilityLabel ??
                (mode === 'inbox'
                  ? t.inboxComposer.composer.saveNoteA11y
                  : isSubmitting
                    ? t.chat.input.sendingA11y
                    : t.chat.input.sendMessageA11y)
              }
              testID={
                submitTestID ??
                (mode === 'inbox' ? 'composer-submit-note' : 'composer-submit-message')
              }
              disabled={!canSubmit}
              variant="primary"
            />
          </Reanimated.View>
        ) : null}
      </Reanimated.View>
    </View>
  );
}

const useStyles = makeStyles((theme) => ({
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
    backgroundColor: theme.colors['bg-surface'],
    borderRadius: 32,
    paddingHorizontal: spacing[1],
  },
  secondarySlot: {
    marginRight: spacing[2],
  },
}));
