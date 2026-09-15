import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import type { TextInput as RNTextInput } from 'react-native';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut, useReducedMotion } from 'react-native-reanimated';

import { useVoiceComposerInput } from '~/components/composer/useVoiceComposerInput';
import { getVoiceComposerErrorPresentation } from '~/components/composer/voiceComposerInput.helpers';
import { useAppTheme, useStyles } from '~/components/theme';
import { IconButton, TextField } from '~/components/ui';
import AppIcon from '~/components/ui/icon';
import { InlineErrorBanner } from '~/components/ui/InlineErrorBanner';
import { VoiceRecordingPanel } from '~/components/voice/VoiceRecordingPanel';

import type { TimeExtractionMode } from './TimeExtractionSheet';
import { TimeProcessingView } from './TimeProcessingView';
import { TimeResultSurface } from './TimeResultSurface';
import { useTimeComposer } from './use-time-composer';

interface TimeComposerProps {
  initialMode: TimeExtractionMode;
  onClose: () => void;
  onOpenEvent: (event: { id: string }) => void;
  onTaskCreated: () => void;
  visible: boolean;
}

export function TimeComposer({
  initialMode,
  onClose,
  onOpenEvent,
  onTaskCreated,
  visible,
}: TimeComposerProps) {
  const [composerError, setComposerError] = useState<string | null>(null);
  const controller = useTimeComposer({ onError: setComposerError, onOpenEvent });
  const {
    ask,
    cancelProcessing,
    cancelResult,
    chooseEvent,
    chooseOpening,
    interaction: state,
    isSaving,
    processingStage,
    prompt: value,
    reset,
    retry,
    setPrompt,
    submitDraft,
    updateDraft,
  } = controller;
  const theme = useAppTheme();
  const styles = useTimeComposerStyles();
  const inputRef = useRef<RNTextInput>(null);
  const startedVoiceRef = useRef(false);
  const valueRef = useRef(value);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  const voice = useVoiceComposerInput({
    getMessage: () => valueRef.current,
    setMessage: setPrompt,
  });

  useEffect(() => {
    if (!visible) {
      startedVoiceRef.current = false;
      reset();
      setComposerError(null);
      return;
    }
    if (initialMode === 'voice' && !startedVoiceRef.current) {
      startedVoiceRef.current = true;
      void voice.handleVoicePress();
      return;
    }
    if (initialMode === 'text') {
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [initialMode, reset, visible, voice.handleVoicePress]);

  const disabled = state.kind === 'parsing' || isSaving || voice.isBusy;
  const canSubmit = value.trim().length > 0;
  const voiceErrorBanner =
    voice.voiceState === 'failed' && voice.error ? (
      <InlineErrorBanner
        message={getVoiceComposerErrorPresentation(voice.error.code).message}
        onDismiss={voice.clearError}
      />
    ) : null;

  const handleSubmitDraft = async () => {
    const saved = await submitDraft();
    if (!saved) {
      return;
    }
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    onTaskCreated();
    onClose();
  };

  const handleChooseEvent = (id: string) => {
    onClose();
    setTimeout(() => chooseEvent(id), 250);
  };

  const handleChooseOpening = (opening: Parameters<NonNullable<typeof chooseOpening>>[0]) => {
    onClose();
    setTimeout(() => void chooseOpening(opening), 250);
  };

  const showResult = state.kind !== 'idle' && state.kind !== 'parsing';
  const showVoiceProcessing =
    voice.voiceState === 'transcribing' || voice.voiceState === 'cleaning';

  return (
    <Animated.View
      entering={reducedMotion ? FadeIn.duration(150) : FadeIn.duration(220)}
      exiting={FadeOut.duration(120)}
      style={styles.container}
    >
      {state.kind === 'parsing' ? (
        <TimeProcessingView onCancel={cancelProcessing} stage={processingStage} />
      ) : showResult ? (
        <TimeResultSurface
          isSaving={isSaving}
          onCancel={cancelResult}
          onChooseEvent={handleChooseEvent}
          onChooseOpening={handleChooseOpening}
          onEditField={updateDraft}
          onRetry={retry}
          onSubmitDraft={handleSubmitDraft}
          state={state}
          testID="time-result"
        />
      ) : voice.isRecording ? (
        <VoiceRecordingPanel
          startedAt={voice.recordingStartedAt}
          onCancel={() => {
            void voice.cancelVoiceRecording();
          }}
          onDone={() => {
            void voice.handleVoicePress();
          }}
        />
      ) : showVoiceProcessing ? (
        <View style={styles.voiceProcessing} testID="time-transcribing">
          <ActivityIndicator color={theme.colors.primary} />
          <Text style={styles.voiceProcessingText}>Transcribing your recording</Text>
        </View>
      ) : (
        <>
          {voiceErrorBanner}
          <TextField
            autoFocus={initialMode === 'text'}
            editable={!disabled}
            focusBorder={false}
            ref={inputRef}
            onChangeText={setPrompt}
            onSubmitEditing={ask}
            placeholder="create or find events"
            returnKeyType="send"
            submitBehavior="submit"
            testID="time-composer-input"
            value={value}
            multiline
            numberOfLines={1}
            style={styles.textField}
          />
          {composerError ? (
            <InlineErrorBanner message={composerError} onDismiss={() => setComposerError(null)} />
          ) : null}
          <View style={styles.actionRow}>
            <IconButton
              accessibilityLabel="Start voice input"
              disabled={voice.isRecordingElsewhere || disabled}
              testID="time-composer-mic-button"
              onPress={() => {
                void voice.handleVoicePress();
              }}
            >
              <AppIcon name="mic.fill" size={20} />
            </IconButton>
            <IconButton
              accessibilityLabel="Interpret time request"
              disabled={disabled || !canSubmit}
              testID="time-composer-submit"
              onPress={ask}
            >
              <AppIcon name="arrow.up" size={20} />
            </IconButton>
          </View>
        </>
      )}
    </Animated.View>
  );
}

function useTimeComposerStyles() {
  return useStyles((theme) => ({
    container: { width: '100%', gap: 12 },
    actionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 8 },
    examples: { gap: 8 },
    example: {
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    exampleText: { ...theme.textVariants.footnote, color: theme.colors.mutedForeground },
    textField: {
      borderRadius: theme.borderRadii.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      minHeight: 18,
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: theme.spacing.md,
    },
    voiceProcessing: { alignItems: 'center', gap: 12, paddingVertical: 24 },
    voiceProcessingText: { ...theme.textVariants.subhead, color: theme.colors.mutedForeground },
  }));
}
