import * as Haptics from 'expo-haptics';
import { useCallback, useState, useEffect } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View, type PressableProps } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useDerivedValue,
  withTiming,
} from 'react-native-reanimated';

import { makeStyles, Text, theme } from '~/components/theme';
import { VOID_MOTION_DURATION_STANDARD } from '~/components/theme/motion';

import AppIcon from '~/components/ui/icon';
import { WaveformVisualizer } from './WaveformVisualizer';
import { useRecorder } from './use-recorder';
import { useTranscriber } from './use-transcriber';

type VoiceInputProps = PressableProps & {
  autoTranscribe?: boolean;
  onRecordingStateChange?: (isRecording: boolean) => void;
  onAudioReady?: (audioUri: string) => void;
  onAudioTranscribed?: (transcription: string) => void;
  onError?: () => void;
};

export function VoiceInput({
  autoTranscribe = false,
  onRecordingStateChange,
  onAudioReady,
  onAudioTranscribed,
  onError,
  style,
  ...props
}: VoiceInputProps) {
  const [lastRecordingUri, setLastRecordingUri] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const styles = useStyles();

  const { mutateAsync: transcribeAudio, isPending: isTranscribing } = useTranscriber({
    onSuccess: (data) => {
      onAudioTranscribed?.(data);
    },
    onError: () => {
      onError?.();
    },
  });

  const handleAudioReady = useCallback(
    async (audioUri: string) => {
      if (autoTranscribe) {
        await transcribeAudio(audioUri);
      } else {
        onAudioReady?.(audioUri);
      }
    },
    [autoTranscribe, onAudioReady, transcribeAudio],
  );

  const { isRecording, isPaused, meterings, startRecording, stopRecording, pauseRecording, resumeRecording } = useRecorder({
    onAudioReady: handleAudioReady,
    onError,
  });

  useEffect(() => {
    if (!isRecording && !isPaused) {
      setDuration(0);
    }
  }, [isRecording, isPaused]);

  useEffect(() => {
    if (!isRecording && !isPaused) return;

    const interval = setInterval(() => {
      setDuration((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [isRecording, isPaused]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const onPress = useCallback(async () => {
    if (isRecording) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await stopRecording();
      onRecordingStateChange?.(false);
      return;
    }

    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await startRecording();
    onRecordingStateChange?.(true);
  }, [isRecording, onRecordingStateChange, startRecording, stopRecording]);

  const onPausePress = useCallback(async () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await pauseRecording();
  }, [pauseRecording]);

  const onResumePress = useCallback(async () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await resumeRecording();
  }, [resumeRecording]);

  const retryTranscription = useCallback(async () => {
    if (!lastRecordingUri) return;
    await transcribeAudio(lastRecordingUri);
  }, [lastRecordingUri, transcribeAudio]);

  const clearRecording = useCallback(() => {
    setLastRecordingUri(null);
  }, []);

  const recordingProgress = useDerivedValue(
    () =>
      withTiming(isRecording ? 1 : 0, {
        duration: VOID_MOTION_DURATION_STANDARD,
      }),
    [isRecording],
  );

  const speakButtonBackground = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      recordingProgress.value,
      [0, 1],
      [theme.colors.muted, theme.colors.destructive],
    ),
  }));

  return (
    <View style={styles.container} testID="voice-input">
      {isRecording || isPaused ? <WaveformVisualizer levels={meterings} /> : null}
      <View style={styles.controlsRow}>
        <AnimatedPressable
          disabled={isTranscribing}
          style={[styles.speakButton, speakButtonBackground, style]}
          onPress={() => {
            void onPress();
          }}
          accessibilityLabel={isRecording ? 'Stop recording' : 'Start voice recording'}
          accessibilityHint={
            isRecording ? 'Tap to stop and transcribe' : 'Tap to record a voice message'
          }
          accessibilityRole="button"
          testID={isRecording ? 'voice-stop-button' : 'voice-start-button'}
          {...props}
        >
          {isTranscribing ? <ActivityIndicator size="small" color={theme.colors.foreground} /> : null}
          {!isTranscribing && isRecording ? (
            <AppIcon name="stop.fill" size={24} color={theme.colors.foreground} />
          ) : null}
          {!isTranscribing && !isRecording ? (
            <AppIcon name="mic" size={24} color={theme.colors.foreground} />
          ) : null}
        </AnimatedPressable>
        {(isRecording || isPaused) ? (
          <View style={styles.durationContainer}>
            <Text variant="body" color="text-primary">
              {formatDuration(duration)}
            </Text>
          </View>
        ) : null}
        {isRecording ? (
          <Pressable onPress={onPausePress} style={styles.pauseButton}>
            <AppIcon name="clock" size={20} color={theme.colors.foreground} />
          </Pressable>
        ) : null}
        {isPaused ? (
          <Pressable onPress={onResumePress} style={styles.pauseButton}>
            <AppIcon name="arrow.clockwise" size={20} color={theme.colors.foreground} />
          </Pressable>
        ) : null}
      </View>
      {lastRecordingUri && autoTranscribe ? (
        <Pressable onPress={() => void retryTranscription()} style={styles.retryButton}>
          <Text variant="body" color="text-secondary">
            RETRY
          </Text>
        </Pressable>
      ) : null}
      {lastRecordingUri && autoTranscribe ? (
        <Pressable onPress={clearRecording} style={styles.retryButton}>
          <Text variant="body" color="text-secondary">
            CLEAR
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      columnGap: t.spacing.sm_12,
    },
    controlsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      columnGap: t.spacing.sm_8,
    },
    speakButton: {
      padding: t.spacing.sm_8,
      borderRadius: t.borderRadii.full,
      borderWidth: 1,
      borderColor: t.colors['border-default'],
    },
    durationContainer: {
      minWidth: 40,
      justifyContent: 'center',
    },
    pauseButton: {
      padding: t.spacing.xs_4,
    },
    retryButton: {
      borderWidth: 1,
      borderColor: t.colors['border-default'],
      paddingHorizontal: t.spacing.sm_8,
      paddingVertical: t.spacing.xs_4,
    },
  }),
);
