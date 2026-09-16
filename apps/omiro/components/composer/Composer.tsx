import { useCallback, useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppTheme, useStyles, withAlpha } from '~/components/theme';
import { InlineErrorBanner } from '~/components/ui/InlineErrorBanner';
import { VoiceRecordingPanel } from '~/components/voice/VoiceRecordingPanel';
import { useReducedMotion } from '~/hooks/use-reduced-motion';
import { nativeMotionAnimations } from '~/services/motion/native-motion';

import type { ComposerProps, ComposerSubmitKind } from './composer.types';
import { ComposerAttachmentRow } from './ComposerAttachmentRow';
import { ComposerProvider } from './ComposerContext';
import { ComposerInput } from './ComposerInput';
import { getComposerSubmissionConfig } from './composerSubmission.helpers';
import { ComposerToolbar } from './ComposerToolbar';
import { useComposerController } from './useComposerController';
import { useComposerSubmission } from './useComposerSubmission';
import { getVoiceComposerErrorPresentation } from './voiceComposerInput.helpers';

export type { ComposerProps } from './composer.types';

export function Composer(props: ComposerProps) {
  return (
    <ComposerProvider
      key={
        props.mode === 'chat'
          ? props.chatId
          : props.presentation === 'new-chat'
            ? 'new-chat'
            : 'inbox'
      }
    >
      <ComposerContent {...props} />
    </ComposerProvider>
  );
}

function ComposerContent(props: ComposerProps) {
  const submission = useComposerSubmission(props);
  const clearComposerRef = useRef<() => void>(() => {});
  const handleWalkieTalkieTranscript = useCallback(
    (rawText: string) => {
      if (!rawText.trim()) {
        return;
      }
      void submission.submit(
        {
          canSubmit: true,
          clearComposer: () => clearComposerRef.current(),
          fileIds: [],
          message: rawText,
          responseModality: 'audio',
        },
        'message',
      );
    },
    [submission],
  );
  const controller = useComposerController({
    entryMode: props.mode === 'inbox' ? props.entryMode : undefined,
    initialMessage: submission.initialMessage,
    isSubmitting: submission.isSubmitting,
    onDraftChange: submission.onDraftChange,
    onClearDraft: submission.onClearDraft,
    onWalkieTalkieTranscript: props.mode === 'chat' ? handleWalkieTalkieTranscript : undefined,
  });
  useEffect(() => {
    clearComposerRef.current = controller.clearComposer;
  }, [controller.clearComposer]);
  // Just the static (mode-only) fields for the outer shell -- the
  // kind-dependent fields (placeholder, submitTestID, ...) get recomputed
  // inside ComposerInput/ComposerToolbar, since those are the only places
  // that know the live, possibly-inferred entry kind without subscribing to
  // the message store here.
  const presentation = getComposerSubmissionConfig(props);

  const handleActiveAreaSubmit = useCallback(
    (kind: ComposerSubmitKind, message: string, canSubmit: boolean) => {
      if (canSubmit) {
        controller.markAttachmentsSubmitted(controller.uploadedAttachmentIds);
      }
      void submission.submit(
        {
          canSubmit,
          clearComposer: controller.clearComposer,
          fileIds: controller.uploadedAttachmentIds,
          message,
        },
        kind,
      );
    },
    [
      controller.clearComposer,
      controller.markAttachmentsSubmitted,
      controller.uploadedAttachmentIds,
      submission,
    ],
  );

  const onToggleWalkieTalkie = useCallback(
    () => controller.voice.setWalkieTalkie((prev) => !prev),
    [controller.voice],
  );

  const theme = useAppTheme();
  const { primary, destructive, border: borderDefault } = theme.colors;
  const insets = useSafeAreaInsets();
  const styles = useStyles((currentTheme) => ({
    composer: { width: '100%', gap: 8 },
    fields: { gap: 8 },
    surface: {
      borderCurve: 'continuous',
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      borderWidth: 0,
      borderTopWidth: StyleSheet.hairlineWidth,
      overflow: 'hidden',
      backgroundColor: currentTheme.colors.muted,
    },
    surfaceContent: { padding: 10, paddingBottom: 6, gap: 10 },
  }));
  const prefersReducedMotion = useReducedMotion();

  const isRecording = controller.voice.isRecording;
  const isWalkieTalkieSending =
    controller.voice.isWalkieTalkie && !isRecording && submission.isSubmitting;
  const showVoicePanel = isRecording || isWalkieTalkieSending;
  const focused = controller.isFocused;
  const borderColor = focused ? primary : isRecording ? destructive : withAlpha(borderDefault, 0.5);

  const errorBanner =
    controller.voice.voiceState === 'failed' && controller.voice.error ? (
      <InlineErrorBanner
        message={getVoiceComposerErrorPresentation(controller.voice.error.code).message}
        onDismiss={controller.voice.clearError}
      />
    ) : undefined;

  const bannerLayout = prefersReducedMotion ? undefined : nativeMotionAnimations.layoutQuick;
  const bannerEntering = prefersReducedMotion
    ? nativeMotionAnimations.fadeInQuick
    : nativeMotionAnimations.fadeInDownQuick;
  const bannerExiting = prefersReducedMotion
    ? nativeMotionAnimations.fadeOutQuick
    : nativeMotionAnimations.fadeOutUpQuick;

  return (
    <Animated.View style={styles.composer} layout={bannerLayout} testID={presentation.shellTestID}>
      {controller.showAttachments ? <ComposerAttachmentRow /> : undefined}

      <View
        collapsable={false}
        style={[
          styles.surface,
          {
            borderTopColor: borderColor,
            // Extends the surface's own fill (not a same-colored sibling
            // behind it) through the bottom safe area, so the rounded top
            // corners stay visible instead of being masked by a square
            // backdrop of the same color.
            paddingBottom: insets.bottom,
          },
        ]}
        testID={`${presentation.shellTestID ?? 'composer'}-surface`}
      >
        <View style={styles.surfaceContent}>
          {errorBanner ? (
            // Split: entering/exiting on the outer view, layout on the inner
            // one -- same reasoning as chat-message.tsx and the two Animated.Views
            // just below. Both on one node fight over opacity.
            <Animated.View entering={bannerEntering} exiting={bannerExiting}>
              <Animated.View layout={bannerLayout}>{errorBanner}</Animated.View>
            </Animated.View>
          ) : undefined}

          {showVoicePanel ? (
            <Animated.View
              entering={nativeMotionAnimations.fadeInQuick}
              exiting={nativeMotionAnimations.fadeOutQuick}
              key="voice-panel"
            >
              <VoiceRecordingPanel
                startedAt={controller.voice.recordingStartedAt}
                onCancel={() => {
                  void controller.voice.cancelVoiceRecording();
                }}
                onDone={() => {
                  void controller.voice.handleVoicePress();
                }}
                phase={isRecording ? 'recording' : 'sending'}
              />
            </Animated.View>
          ) : (
            <Animated.View
              entering={nativeMotionAnimations.fadeInQuick}
              exiting={nativeMotionAnimations.fadeOutQuick}
              key="composer-fields"
            >
              <Animated.View style={styles.fields} layout={bannerLayout}>
                <ComposerInput
                  composerProps={props}
                  messageStore={controller.messageStore}
                  entryMode={controller.entryMode}
                  manualEntryKind={controller.manualEntryKind}
                  onFocus={controller.handleInputFocus}
                  onBlur={controller.handleInputBlur}
                  onChangeMessage={controller.setMessage}
                />
                <ComposerToolbar
                  composerProps={props}
                  messageStore={controller.messageStore}
                  entryMode={controller.entryMode}
                  manualEntryKind={controller.manualEntryKind}
                  onManualEntryKindChange={controller.setManualEntryKind}
                  uploadedAttachmentCount={controller.uploadedAttachmentIds.length}
                  state={{
                    isFocused: controller.isFocused,
                    showAttachments: controller.showAttachments,
                    isInteractionBusy: controller.isInteractionBusy,
                    isSubmitting: submission.isSubmitting,
                  }}
                  capabilities={{
                    canPickMedia: controller.canPickMedia,
                    canToggleVoice: controller.canToggleVoice,
                  }}
                  voice={controller.voice}
                  onChangeMessage={controller.setMessage}
                  onToggleWalkieTalkie={props.mode === 'chat' ? onToggleWalkieTalkie : undefined}
                  onSubmit={handleActiveAreaSubmit}
                />
              </Animated.View>
            </Animated.View>
          )}
        </View>
      </View>
    </Animated.View>
  );
}
