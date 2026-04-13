import { useCallback } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { makeStyles, Text, theme } from '~/components/theme';
import AppIcon from '~/components/ui/icon';
import { WaveformVisualizer } from './WaveformVisualizer';
import { useResponse } from './useResponse';

interface VoiceResponseProps {
  audioUri: string;
  onDismiss?: () => void;
}

export function VoiceResponse({ audioUri, onDismiss }: VoiceResponseProps) {
  const { isPlaying, duration, position, play, pause, seek, stop } = useResponse({
    audioUri,
    onComplete: onDismiss,
  });

  const styles = useStyles();

  const handlePlayPause = useCallback(() => {
    if (isPlaying) {
      void pause();
    } else {
      void play();
    }
  }, [isPlaying, play, pause]);

  const handleSeek = useCallback(
    (fraction: number) => {
      const newPosition = Math.floor(duration * fraction * 1000);
      void seek(newPosition);
    },
    [duration, seek],
  );

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <View style={styles.container}>
      <WaveformVisualizer
        levels={[]}
        isPlayback={true}
        playbackPosition={duration > 0 ? Math.floor((position / duration) * 12) : 0}
      />
      <View style={styles.controls}>
        <Pressable onPress={handlePlayPause} style={styles.playButton}>
          <AppIcon
            name={isPlaying ? 'clock' : 'arrow.clockwise'}
            size={24}
            color={theme.colors.foreground}
          />
        </Pressable>
        <View style={styles.timeContainer}>
          <Text variant="body" color="text-secondary">
            {formatTime(position)}
          </Text>
          <View style={styles.scrubber} />
          <Text variant="body" color="text-secondary">
            {formatTime(duration)}
          </Text>
        </View>
        <Pressable onPress={onDismiss} style={styles.closeButton}>
          <AppIcon name="xmark" size={24} color={theme.colors.foreground} />
        </Pressable>
      </View>
    </View>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    container: {
      gap: t.spacing.sm_12,
    },
    controls: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.spacing.sm_12,
    },
    playButton: {
      padding: t.spacing.sm_8,
      borderRadius: t.borderRadii.full,
      borderWidth: 1,
      borderColor: t.colors['border-default'],
    },
    timeContainer: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.spacing.xs_4,
    },
    scrubber: {
      flex: 1,
      height: 2,
      backgroundColor: t.colors.primary,
      borderRadius: 1,
    },
    closeButton: {
      padding: t.spacing.xs_4,
    },
  }),
);
