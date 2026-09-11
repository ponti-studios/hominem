import { useEffect, useRef, useState } from 'react';
import type { TextInput as RNTextInput } from 'react-native';
import { ActivityIndicator, View } from 'react-native';
import Animated, { FadeIn, FadeOut, useReducedMotion } from 'react-native-reanimated';

import { useVoiceComposerInput } from '~/components/composer/useVoiceComposerInput';
import { getVoiceComposerErrorPresentation } from '~/components/composer/voiceComposerInput.helpers';
import { useAppTheme, useStyles } from '~/components/theme';
import { BlurCard, IconButton, TextField } from '~/components/ui';
import AppIcon from '~/components/ui/icon';
import { InlineErrorBanner } from '~/components/ui/InlineErrorBanner';
import { VoiceRecordingPanel } from '~/components/voice/VoiceRecordingPanel';

import { TimeResultSurface } from './TimeResultSurface';
import { useTimeComposer } from './use-time-composer';

interface TimeComposerProps {
  onOpenEvent: (event: { id: string }) => void;
}

function useTimeComposerStyles() {
  return useStyles(() => ({
    composerCard: {
      width: '100%',
    },
    composerCardContent: {
      gap: 8,
      padding: 12,
    },
    actionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 8 },
    loadingState: { alignItems: 'center', justifyContent: 'center', minHeight: 44 },
    textField: {
      borderRadius: 0,
      borderWidth: 0,
      minHeight: 0,
      paddingHorizontal: 0,
      paddingVertical: 0,
    },
  }));
}

export function TimeComposer({ onOpenEvent }: TimeComposerProps) {
  const [composerError, setComposerError] = useState<string | null>(null);
  const controller = useTimeComposer({ onError: setComposerError, onOpenEvent });
  const {
    ask,
    cancelResult,
    chooseEvent,
    chooseOpening,
    interaction: state,
    isSaving,
    prompt: value,
    setPrompt,
    submitDraft,
    updateDraft,
  } = controller;
  const disabled = state.kind === 'parsing' || isSaving;
  const theme = useAppTheme();
  const { primary: primaryColor } = theme.colors;
  const styles = useTimeComposerStyles();
  const inputRef = useRef<RNTextInput>(null);
  const reducedMotion = useReducedMotion();

  const valueRef = useRef(value);
  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  const voice = useVoiceComposerInput({
    getMessage: () => valueRef.current,
    setMessage: setPrompt,
  });

  const canSubmit = value.trim().length > 0;
  const isIdle = state.kind === 'idle';
  const isParsing = state.kind === 'parsing';

  useEffect(() => {
    if (isIdle && value) {
      inputRef.current?.focus();
    }
  }, [isIdle, value]);

  const voiceErrorBanner =
    voice.voiceState === 'failed' && voice.error ? (
      <InlineErrorBanner
        message={getVoiceComposerErrorPresentation(voice.error.code).message}
        onDismiss={voice.clearError}
      />
    ) : undefined;

  return (
    <>
      {!isIdle && !isParsing ? (
        <TimeResultSurface
          isSaving={isSaving}
          onCancel={cancelResult}
          onChooseEvent={chooseEvent}
          onChooseOpening={chooseOpening}
          onEditField={updateDraft}
          onSubmitDraft={submitDraft}
          state={state}
          testID="time-result"
        />
      ) : null}

      {isIdle ? (
        <Animated.View
          entering={FadeIn.duration(reducedMotion ? 150 : 180)}
          exiting={FadeOut.duration(120)}
        >
          <BlurCard
            contentStyle={styles.composerCardContent}
            style={styles.composerCard}
            testID="time-composer"
          >
            {voiceErrorBanner}
            {voice.isRecording ? (
              <VoiceRecordingPanel
                startedAt={voice.recordingStartedAt}
                onCancel={() => {
                  void voice.cancelVoiceRecording();
                }}
                onDone={() => {
                  void voice.handleVoicePress();
                }}
              />
            ) : (
              <TextField
                editable={!disabled}
                focusBorder={false}
                ref={inputRef}
                onChangeText={setPrompt}
                onSubmitEditing={ask}
                placeholder="Add or search anything..."
                returnKeyType="send"
                submitBehavior="submit"
                testID="time-composer-input"
                value={value}
                multiline
                numberOfLines={5}
                style={styles.textField}
              />
            )}
            {voice.isRecording ? null : (
              <>
                {composerError ? (
                  <InlineErrorBanner
                    message={composerError}
                    onDismiss={() => setComposerError(null)}
                  />
                ) : null}
                <View style={styles.actionRow}>
                  <IconButton
                    accessibilityLabel="Start voice input"
                    disabled={voice.isRecordingElsewhere}
                    testID="time-composer-mic-button"
                    onPress={() => {
                      void voice.handleVoicePress();
                    }}
                  >
                    <AppIcon name="mic.fill" size={20} />
                  </IconButton>
                  <IconButton
                    accessibilityLabel={
                      isParsing ? 'Interpreting time request' : 'Interpret time request'
                    }
                    disabled={disabled || !canSubmit || voice.isBusy}
                    testID="time-composer-submit"
                    onPress={ask}
                  >
                    <AppIcon name="arrow.up" size={20} />
                  </IconButton>
                </View>
              </>
            )}
          </BlurCard>
        </Animated.View>
      ) : isParsing ? (
        <TimeResultSurface
          accessibilityLabel="Interpreting time request"
          testID="time-result-parsing"
        >
          <View style={styles.loadingState}>
            <ActivityIndicator color={primaryColor} />
          </View>
        </TimeResultSurface>
      ) : null}
    </>
  );
}
