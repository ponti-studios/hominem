import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import type { TextInput as RNTextInput } from 'react-native';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { KeyboardStickyView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useVoiceComposerInput } from '~/components/composer/useVoiceComposerInput';
import { getVoiceComposerErrorPresentation } from '~/components/composer/voiceComposerInput.helpers';
import { fontFamilies, useAppTheme, useStyles, withAlpha } from '~/components/theme';
import { Chip } from '~/components/ui';
import AppIcon from '~/components/ui/icon';
import { InlineErrorBanner } from '~/components/ui/InlineErrorBanner';
import { VoiceRecordingPanel } from '~/components/voice/VoiceRecordingPanel';

import type { TimeProcessingStage } from './time-types';
import type { useTimeComposer } from './use-time-composer';

export const CAPTURE_BAR_HEIGHT = 60;
export const CAPTURE_CHIPS_HEIGHT = 46;
const KEYBOARD_HOVER_GAP = 12;

const PROMPT_STARTERS = [
  { label: 'Find time', prefix: 'Find an hour ', icon: 'clock' },
  { label: 'New task', prefix: 'Remind me to ', icon: 'checkmark.circle' },
  { label: 'Tomorrow 9am', prefix: 'Tomorrow at 9am ', icon: 'sunrise' },
  { label: 'What’s on tomorrow?', prefix: 'What’s on tomorrow?', icon: 'calendar' },
] as const;

const STAGE_LABELS: Record<TimeProcessingStage, string> = {
  checkingSchedule: 'Checking your schedule…',
  preparingSuggestion: 'Preparing your suggestion…',
  understanding: 'Understanding…',
};

type Controller = ReturnType<typeof useTimeComposer>;

interface TimeCaptureBarProps {
  controller: Controller;
}

// One floating bar for every request. Idle it offers quick starters; while a
// request is in flight the bar itself shows progress (no separate screen);
// results arrive in a sheet (see TimeResultSheet).
export function TimeCaptureBar({ controller }: TimeCaptureBarProps) {
  const { bottom: safeAreaBottom } = useSafeAreaInsets();
  const theme = useAppTheme();
  const { cancelProcessing, interaction, isSaving, processingStage, prompt, setPrompt, ask } =
    controller;
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<RNTextInput>(null);
  const promptRef = useRef(prompt);
  const styles = useStyles((t) => ({
    dock: { bottom: safeAreaBottom, left: 0, position: 'absolute', right: 0 },
    chips: { gap: 8, paddingBottom: 10, paddingHorizontal: 16 },
    bar: {
      alignItems: 'center',
      backgroundColor: t.colors.ink,
      borderCurve: 'continuous',
      borderRadius: CAPTURE_BAR_HEIGHT / 2,
      boxShadow: t.shadows.float,
      flexDirection: 'row',
      gap: 10,
      height: CAPTURE_BAR_HEIGHT,
      marginBottom: 8,
      marginHorizontal: 16,
      paddingHorizontal: 8,
    },
    sparkle: {
      alignItems: 'center',
      backgroundColor: t.colors.primary,
      borderRadius: 22,
      height: 44,
      justifyContent: 'center',
      width: 44,
    },
    input: {
      color: t.colors.inkForeground,
      flex: 1,
      fontFamily: fontFamilies.sans,
      fontSize: 17,
      fontWeight: '500',
      paddingVertical: 0,
    },
    status: { ...t.textVariants.headline, color: t.colors.inkForeground, flex: 1 },
    action: {
      alignItems: 'center',
      borderRadius: 22,
      height: 44,
      justifyContent: 'center',
      width: 44,
    },
    voiceCard: {
      backgroundColor: t.colors.card,
      borderCurve: 'continuous',
      borderRadius: t.borderRadii.xl,
      boxShadow: t.shadows.float,
      marginBottom: 8,
      marginHorizontal: 16,
      padding: 14,
    },
    voiceProcessing: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 12,
      justifyContent: 'center',
      padding: 8,
    },
    voiceProcessingText: { ...t.textVariants.subhead, color: t.colors.mutedForeground },
  }));

  useEffect(() => {
    promptRef.current = prompt;
  }, [prompt]);

  const voice = useVoiceComposerInput({
    getMessage: () => promptRef.current,
    setMessage: setPrompt,
  });

  const parsing = interaction.kind === 'parsing';
  const disabled = parsing || isSaving || voice.isBusy;
  const canSubmit = prompt.trim().length > 0;
  const transcribing = voice.voiceState === 'transcribing' || voice.voiceState === 'cleaning';
  const showStarters = !focused && !canSubmit && !parsing && !voice.isRecording && !transcribing;

  const submit = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    ask();
    inputRef.current?.blur();
  };

  const startWith = (prefix: string) => {
    setPrompt(prefix);
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const voiceError =
    voice.voiceState === 'failed' && voice.error ? (
      <View style={styles.chips}>
        <InlineErrorBanner
          message={getVoiceComposerErrorPresentation(voice.error.code).message}
          onDismiss={voice.clearError}
        />
      </View>
    ) : null;

  return (
    <KeyboardStickyView
      offset={{ closed: 0, opened: safeAreaBottom - KEYBOARD_HOVER_GAP }}
      style={styles.dock}
      testID="time-floating-composer"
    >
      {voiceError}
      {showStarters ? (
        <ScrollView
          contentContainerStyle={styles.chips}
          horizontal
          showsHorizontalScrollIndicator={false}
          testID="time-starters"
        >
          {PROMPT_STARTERS.map((starter) => (
            <Chip
              icon={starter.icon}
              key={starter.label}
              label={starter.label}
              onPress={() => startWith(starter.prefix)}
              testID={`time-starter-${starter.label}`}
              tone="outline"
            />
          ))}
        </ScrollView>
      ) : null}
      {voice.isRecording ? (
        <View style={styles.voiceCard}>
          <VoiceRecordingPanel
            onCancel={() => {
              void voice.cancelVoiceRecording();
            }}
            onDone={() => {
              void voice.handleVoicePress();
            }}
            startedAt={voice.recordingStartedAt}
          />
        </View>
      ) : transcribing ? (
        <View style={[styles.voiceCard, styles.voiceProcessing]} testID="time-transcribing">
          <ActivityIndicator color={theme.colors.primary} />
          <Text style={styles.voiceProcessingText}>Transcribing your recording</Text>
        </View>
      ) : (
        <View style={styles.bar}>
          <View style={styles.sparkle}>
            <AppIcon name="sparkles" size={20} tintColor={theme.colors.primaryForeground} />
          </View>
          {parsing ? (
            <>
              <Text accessibilityLiveRegion="polite" style={styles.status}>
                {STAGE_LABELS[processingStage]}
              </Text>
              <Pressable
                accessibilityLabel="Cancel"
                accessibilityRole="button"
                onPress={cancelProcessing}
                style={[
                  styles.action,
                  { backgroundColor: withAlpha(theme.colors.inkForeground, 0.2) },
                ]}
                testID="time-processing-cancel"
              >
                <AppIcon name="xmark" size={18} tintColor={theme.colors.inkForeground} />
              </Pressable>
            </>
          ) : (
            <>
              <TextInput
                editable={!disabled}
                multiline={false}
                onBlur={() => setFocused(false)}
                onChangeText={setPrompt}
                onFocus={() => setFocused(true)}
                onSubmitEditing={submit}
                placeholder="Add anything…"
                placeholderTextColor={withAlpha(theme.colors.inkForeground, 0.55)}
                ref={inputRef}
                returnKeyType="send"
                selectionColor={theme.colors.lime}
                style={styles.input}
                testID="time-composer-input"
                value={prompt}
              />
              {canSubmit ? (
                <Pressable
                  accessibilityLabel="Interpret time request"
                  accessibilityRole="button"
                  disabled={disabled}
                  onPress={submit}
                  style={[styles.action, { backgroundColor: theme.colors.primary }]}
                  testID="time-composer-submit"
                >
                  <AppIcon name="arrow.up" size={20} tintColor={theme.colors.primaryForeground} />
                </Pressable>
              ) : (
                <Pressable
                  accessibilityLabel="Start voice input"
                  accessibilityRole="button"
                  disabled={voice.isRecordingElsewhere || disabled}
                  onPress={() => {
                    setFocused(true);
                    void voice.handleVoicePress();
                  }}
                  style={[
                    styles.action,
                    { backgroundColor: withAlpha(theme.colors.inkForeground, 0.2) },
                  ]}
                  testID="time-composer-mic-button"
                >
                  <AppIcon name="mic.fill" size={20} tintColor={theme.colors.inkForeground} />
                </Pressable>
              )}
            </>
          )}
        </View>
      )}
    </KeyboardStickyView>
  );
}
