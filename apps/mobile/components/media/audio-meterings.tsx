import { useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { theme } from '~/theme';

import { BAR_GAP, BAR_WIDTH, buildAudioBarModels, normalizeDb } from './audio-meterings-model';

const MAX_HEIGHT = 50;
const BAR_RADIUS = 2;
const SPRING_CONFIG = { damping: 12, stiffness: 180 };

export const useNormalizedLevels = (levels: number[]) =>
  useMemo(() => levels.map(normalizeDb), [levels]);

function AudioBar({ targetHeight }: { targetHeight: number }) {
  const height = useSharedValue(targetHeight);

  useEffect(() => {
    height.value = withSpring(targetHeight, SPRING_CONFIG);
  }, [height, targetHeight]);

  const style = useAnimatedStyle(() => ({
    height: height.value,
  }));

  return <Animated.View style={[styles.bar, style]} testID="audio-meter-bar" />;
}

export const AudioLevelVisualizer: React.FC<{ levels: number[] }> = ({ levels }) => {
  const bars = useMemo(() => buildAudioBarModels(levels), [levels]);
  const width = bars.length > 0 ? bars.length * BAR_WIDTH + (bars.length - 1) * BAR_GAP : 0;

  return (
    <View style={[styles.container, { width }]} testID="audio-meter">
      {bars.map((bar) => (
        <AudioBar key={bar.key} targetHeight={bar.targetHeight} />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: BAR_GAP,
    height: MAX_HEIGHT,
    justifyContent: 'center',
  },
  bar: {
    backgroundColor: theme.colors.foreground,
    borderRadius: BAR_RADIUS,
    width: BAR_WIDTH,
  },
});

export { Animated };
