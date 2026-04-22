import { Image } from 'expo-image';
import React, { useEffect } from 'react';
import Animated, {
  Easing,
  interpolateColor,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { useThemeColors } from '~/components/theme/theme';

import { useSharedStyles } from '../theme/styles';

const AnimatedImage = Animated.createAnimatedComponent(Image);

interface PersonSaveIconProps {
  feedback: 'idle' | 'success' | 'error';
}

export function PersonSaveIcon({ feedback }: PersonSaveIconProps) {
  const themeColors = useThemeColors();
  const styles = useSharedStyles();
  const progress = useSharedValue(0);
  const shakeX = useSharedValue(0);

  const successColor = themeColors.success;
  const destructiveColor = themeColors.destructive;
  const iconPrimaryColor = themeColors['icon-primary'];
  const bgElevatedColor = themeColors['bg-elevated'];

  useEffect(() => {
    if (feedback === 'idle') {
      progress.value = 0;
      shakeX.value = 0;
      return;
    }

    progress.value = 0;

    if (feedback === 'success') {
      progress.value = withSequence(
        withTiming(1, { duration: 160, easing: Easing.out(Easing.quad) }),
        withTiming(0, { duration: 220, easing: Easing.inOut(Easing.quad) }),
      );
      return;
    }

    shakeX.value = withSequence(
      withTiming(-4, { duration: 40 }),
      withTiming(4, { duration: 40 }),
      withTiming(-3, { duration: 36 }),
      withTiming(3, { duration: 36 }),
      withTiming(-2, { duration: 32 }),
      withTiming(2, { duration: 32 }),
      withTiming(0, { duration: 32 }),
    );
    progress.value = withSequence(
      withTiming(1, { duration: 140, easing: Easing.out(Easing.quad) }),
      withTiming(0, { duration: 220, easing: Easing.inOut(Easing.quad) }),
    );
  }, [feedback, progress, shakeX]);

  const animatedProps = useAnimatedProps(() => {
    const targetColor =
      feedback === 'success'
        ? successColor
        : feedback === 'error'
          ? destructiveColor
          : iconPrimaryColor;

    return {
      tintColor: interpolateColor(progress.value, [0, 1], [iconPrimaryColor, targetColor]),
    };
  });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shakeX.value }],
  }));

  return (
    <Animated.View
      style={[styles.rowIconWrap, { backgroundColor: bgElevatedColor }, animatedStyle]}
    >
      <AnimatedImage
        source="sf:person.crop.circle"
        style={styles.rowIcon}
        contentFit="contain"
        animatedProps={animatedProps}
      />
    </Animated.View>
  );
}
