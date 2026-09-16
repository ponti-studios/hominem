import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import type { TextInput as RNTextInput } from 'react-native';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { KeyboardStickyView } from 'react-native-keyboard-controller';
import Animated, {
  FadeIn,
  FadeOut,
  LinearTransition,
  useReducedMotion,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useVoiceComposerInput } from '~/components/composer/useVoiceComposerInput';
import { getVoiceComposerErrorPresentation } from '~/components/composer/voiceComposerInput.helpers';
import { useAppTheme, useStyles } from '~/components/theme';
import { Card, IconButton, TextField } from '~/components/ui';
import AppIcon from '~/components/ui/icon';
import { InlineErrorBanner } from '~/components/ui/InlineErrorBanner';
import { VoiceRecordingPanel } from '~/components/voice/VoiceRecordingPanel';

import { TimeProcessingView } from './TimeProcessingView';
import { TimeResultSurface } from './TimeResultSurface';
import { useTimeComposer } from './use-time-composer';

const BLUR_COLLAPSE_DELAY_MS = 180;
const KEYBOARD_HOVER_GAP = 12;

interface TimeFloatingComposerProps {
  onOpenEvent: (event: { id: string }) => void;
  onTaskCreated: () => void;
}

// A single persistent floating card, docked where the old mic/add FABs
// lived, that morphs in place through collapsed -> focused -> thinking ->
// result instead of presenting a separate bottom sheet.
export function TimeFloatingComposer({ onOpenEvent, onTaskCreated }: TimeFloatingComposerProps) {
  const { bottom: safeAreaBottom } = useSafeAreaInsets();
  const [composerError, setComposerError] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);
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
    retry,
    setPrompt,
    submitDraft,
    updateDraft,
  } = controller;
  const theme = useAppTheme();
  const styles = useFloatingComposerStyles(safeAreaBottom);
  const keyboardOpenedOffset = safeAreaBottom + 16 - KEYBOARD_HOVER_GAP;
  const inputRef = useRef<RNTextInput>(null);
  const valueRef = useRef(value);
  const blurTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  useEffect(
    () => () => {
      if (blurTimeoutRef.current) {
        clearTimeout(blurTimeoutRef.current);
      }
    },
    [],
  );

  const voice = useVoiceComposerInput({
    getMessage: () => valueRef.current,
    setMessage: setPrompt,
  });

  const disabled = state.kind === 'parsing' || isSaving || voice.isBusy;
  const canSubmit = value.trim().length > 0;
  const showResult = state.kind !== 'idle' && state.kind !== 'parsing';
  const showVoiceProcessing =
    voice.voiceState === 'transcribing' || voice.voiceState === 'cleaning';
  const isBusyState = voice.isRecording || showVoiceProcessing;
  const expanded = focused || state.kind !== 'idle' || isBusyState;
  const showBackdrop = focused && state.kind === 'idle' && !isBusyState;
  const voiceErrorBanner =
    voice.voiceState === 'failed' && voice.error ? (
      <InlineErrorBanner
        message={getVoiceComposerErrorPresentation(voice.error.code).message}
        onDismiss={voice.clearError}
      />
    ) : null;

  const cancelPendingBlurCollapse = () => {
    if (blurTimeoutRef.current) {
      clearTimeout(blurTimeoutRef.current);
      blurTimeoutRef.current = null;
    }
  };

  const collapse = () => {
    cancelPendingBlurCollapse();
    setFocused(false);
    inputRef.current?.blur();
  };

  const handleFocusPress = () => {
    setFocused(true);
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const handleMicPress = () => {
    cancelPendingBlurCollapse();
    setFocused(true);
    void voice.handleVoicePress();
  };

  const handleInputBlur = () => {
    blurTimeoutRef.current = setTimeout(() => {
      if (valueRef.current.trim().length === 0) {
        setFocused(false);
      }
    }, BLUR_COLLAPSE_DELAY_MS);
  };

  const handleSubmitDraft = async () => {
    const saved = await submitDraft();
    if (!saved) {
      return;
    }
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    onTaskCreated();
    setFocused(false);
  };

  const handleChooseEvent = (id: string) => {
    chooseEvent(id);
    setFocused(false);
  };

  const handleChooseOpening = (opening: Parameters<NonNullable<typeof chooseOpening>>[0]) => {
    void chooseOpening(opening);
    setFocused(false);
  };

  const handleCancelResult = () => {
    cancelResult();
    setFocused(false);
  };

  const handleCancelProcessing = () => {
    cancelProcessing();
    setFocused(false);
  };

  if (showResult) {
    return (
      <KeyboardStickyView
        offset={{ closed: 0, opened: keyboardOpenedOffset }}
        style={styles.dock}
        testID="time-floating-composer"
      >
        <TimeResultSurface
          isSaving={isSaving}
          onCancel={handleCancelResult}
          onChooseEvent={handleChooseEvent}
          onChooseOpening={handleChooseOpening}
          onEditField={updateDraft}
          onRetry={retry}
          onSubmitDraft={handleSubmitDraft}
          state={state}
          testID="time-result"
        />
      </KeyboardStickyView>
    );
  }

  return (
    <>
      {showBackdrop ? (
        <Animated.View
          entering={FadeIn.duration(120)}
          exiting={FadeOut.duration(120)}
          style={styles.backdrop}
        >
          <Pressable
            accessibilityLabel="Dismiss composer"
            onPress={collapse}
            style={styles.backdropPressable}
          />
        </Animated.View>
      ) : null}
      <KeyboardStickyView
        offset={{ closed: 0, opened: keyboardOpenedOffset }}
        style={styles.dock}
        testID="time-floating-composer"
      >
        <Animated.View layout={reducedMotion ? undefined : LinearTransition.duration(220)}>
          <Card
            style={[
              styles.card,
              expanded ? styles.cardExpanded : styles.cardCollapsed,
              { boxShadow: theme.shadows.md },
            ]}
          >
            {state.kind === 'parsing' ? (
              <TimeProcessingView onCancel={handleCancelProcessing} stage={processingStage} />
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
                <View style={focused ? styles.rowsFocused : styles.rowCollapsed}>
                  <TextField
                    editable={!disabled}
                    focusBorder={false}
                    ref={inputRef}
                    onBlur={handleInputBlur}
                    onChangeText={setPrompt}
                    onFocus={handleFocusPress}
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
                  <View style={focused ? styles.focusedButtonsRow : styles.collapsedButtonsRow}>
                    <IconButton
                      accessibilityLabel="Start voice input"
                      disabled={voice.isRecordingElsewhere || disabled}
                      onPressIn={cancelPendingBlurCollapse}
                      testID="time-composer-mic-button"
                      onPress={handleMicPress}
                      variant="solid"
                    >
                      <AppIcon
                        name="mic.fill"
                        size={20}
                        tintColor={theme.colors.primaryForeground}
                      />
                    </IconButton>
                    <IconButton
                      accessibilityLabel="Interpret time request"
                      disabled={disabled || !canSubmit}
                      onPressIn={cancelPendingBlurCollapse}
                      testID="time-composer-submit"
                      onPress={ask}
                      variant="solid"
                    >
                      <AppIcon
                        name="arrow.up"
                        size={20}
                        tintColor={theme.colors.primaryForeground}
                      />
                    </IconButton>
                  </View>
                </View>
                {composerError ? (
                  <InlineErrorBanner
                    message={composerError}
                    onDismiss={() => setComposerError(null)}
                  />
                ) : null}
              </>
            )}
          </Card>
        </Animated.View>
      </KeyboardStickyView>
    </>
  );
}

function useFloatingComposerStyles(safeAreaBottom: number) {
  return useStyles((theme) => ({
    dock: {
      position: 'absolute',
      left: 16,
      right: 16,
      bottom: 0,
      paddingBottom: safeAreaBottom + 16,
    },
    backdrop: { position: 'absolute', top: -2000, left: -16, right: -16, bottom: -16 },
    backdropPressable: { flex: 1 },
    card: {
      backgroundColor: theme.colors.card,
      borderWidth: 0,
      borderCurve: 'continuous',
      gap: 10,
    },
    cardCollapsed: { borderRadius: 26, padding: 8 },
    cardExpanded: { borderRadius: 22, padding: 12 },
    rowCollapsed: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    rowsFocused: { gap: 10 },
    collapsedButtonsRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    focusedButtonsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    textField: {
      flex: 1,
      minHeight: 40,
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: theme.spacing.md,
    },
    voiceProcessing: { alignItems: 'center', gap: 12, paddingVertical: 16 },
    voiceProcessingText: { ...theme.textVariants.subhead, color: theme.colors.mutedForeground },
  }));
}
