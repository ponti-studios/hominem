import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, withTiming, Easing } from 'react-native-reanimated';
import { useMemo } from 'react';
import { makeStyles, theme } from '~/components/theme';

interface WaveformVisualizerProps {
  levels: number[];
  isPlayback?: boolean;
  playbackPosition?: number;
}

const BAR_COUNT = 12;

export function WaveformVisualizer({ levels, isPlayback = false, playbackPosition = 0 }: WaveformVisualizerProps) {
  const styles = useStyles();

  const bars = useMemo(() => {
    const filledBars = levels.length;
    const emptyBars = BAR_COUNT - filledBars;
    return [
      ...levels.slice(-BAR_COUNT),
      ...Array(Math.max(0, emptyBars)).fill(0),
    ];
  }, [levels]);

  return (
    <View style={styles.container}>
      {bars.map((level, index) => (
        <WaveformBar
          key={`bar-${index}`}
          level={level}
          isActive={index < levels.length}
          isPlaybackBar={isPlayback && index < playbackPosition}
        />
      ))}
    </View>
  );
}

interface WaveformBarProps {
  level: number;
  isActive: boolean;
  isPlaybackBar?: boolean;
}

function WaveformBar({ level, isActive, isPlaybackBar }: WaveformBarProps) {
  const styles = useStyles();

  const animatedStyle = useAnimatedStyle(() => {
    return {
      height: withTiming(isActive ? Math.max(4, level * 60) : 4, {
        duration: 100,
        easing: Easing.out(Easing.ease),
      }),
      backgroundColor: isPlaybackBar ? theme.colors.primary : theme.colors.destructive,
    };
  }, [isActive, level, isPlaybackBar]);

  return (
    <Animated.View
      style={[styles.bar, animatedStyle]}
      testID={`waveform-bar-${isActive ? 'active' : 'empty'}`}
    />
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      columnGap: t.spacing.xs_4,
      flex: 1,
      minHeight: 60,
    },
    bar: {
      width: 4,
      borderRadius: 2,
      minHeight: 4,
    },
  }),
);
