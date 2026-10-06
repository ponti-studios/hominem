import { useCallback } from 'react';
import { View } from 'react-native';
import Animated from 'react-native-reanimated';

import { useStyles } from '~/components/theme';
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

const SURFACE_RADIUS = 30;

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
  const controller = useComposerController({
    entryMode: props.mode === 'inbox' ? props.entryMode : undefined,
    defaultEntryKind: props.mode === 'inbox' ? props.defaultEntryKind : undefined,
    initialMessage: submission.initialMessage,
    isSubmitting: submission.isSubmitting,
    onDraftChange: submission.onDraftChange,
    onClearDraft: submission.onClearDraft,
  });
  // Just the static (mode-only) fields for the outer shell -- the
  // kind-dependent fields (placeholder, submitTestID, ...) get recomputed
  // inside ComposerInput/ComposerToolbar, since those are the only places
  // that know the live, possibly-inferred entry kind without subscribing to
  // the message store here.
  const presentation = getComposerSubmissionConfig(props);

  const onPlan = props.mode === 'inbox' ? props.onPlan : undefined;
  // Planning hands the words over and empties the composer; if the request
  // fails or is cancelled the planner puts them back.
  const handlePlan = useCallback(
    (message: string) => {
      if (!message.trim()) {
        return;
      }
      onPlan?.(message, controller.setMessage);
      controller.clearComposer();
    },
    [controller.clearComposer, controller.setMessage, onPlan],
  );

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
          restoreMessage: controller.setMessage,
        },
        kind,
      );
    },
    [
      controller.clearComposer,
      controller.markAttachmentsSubmitted,
      controller.setMessage,
      controller.uploadedAttachmentIds,
      submission,
    ],
  );

  const styles = useStyles((currentTheme) => ({
    composer: { width: '100%', gap: 8 },
    fields: { gap: 8 },
    // The floating bar: the same dark surface in light and dark mode (`bar`
    // tokens do not flip with the color scheme). Its own margin comes from
    // ComposerDock.
    surface: {
      backgroundColor: currentTheme.colors.bar,
      borderCurve: 'continuous',
      borderRadius: SURFACE_RADIUS,
      boxShadow: currentTheme.shadows.bar,
    },
    surfaceContent: { gap: 8, paddingBottom: 8, paddingHorizontal: 16, paddingTop: 14 },
  }));
  const prefersReducedMotion = useReducedMotion();

  const isRecording = controller.voice.isRecording;

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
      <View
        collapsable={false}
        style={styles.surface}
        testID={`${presentation.shellTestID ?? 'composer'}-surface`}
      >
        <View style={styles.surfaceContent}>
          {controller.showAttachments ? <ComposerAttachmentRow /> : undefined}
          {errorBanner ? (
            // Split: entering/exiting on the outer view, layout on the inner
            // one -- same reasoning as chat-message.tsx and the two Animated.Views
            // just below. Both on one node fight over opacity.
            <Animated.View entering={bannerEntering} exiting={bannerExiting}>
              <Animated.View layout={bannerLayout}>{errorBanner}</Animated.View>
            </Animated.View>
          ) : undefined}

          {isRecording ? (
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
                tone="ink"
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
                  onSubmit={handleActiveAreaSubmit}
                  onPlan={props.mode === 'inbox' && props.onPlan ? handlePlan : undefined}
                />
              </Animated.View>
            </Animated.View>
          )}
        </View>
      </View>
    </Animated.View>
  );
}
