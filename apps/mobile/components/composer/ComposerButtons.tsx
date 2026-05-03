import type { SFSymbol } from 'expo-symbols';
import React, { useEffect } from 'react';
import { Pressable } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { makeStyles, spacing, useThemeColors } from '~/components/theme';
import AppIcon from '~/components/ui/icon';
import { useReducedMotion } from '~/hooks/use-reduced-motion';

const BTN_SIZE = spacing[6]; // 32px
const BTN_ICON_SIZE = spacing[4] + 2; // 18px

interface ActionButtonProps {
  icon: SFSymbol;
  onPress: () => void;
  disabled: boolean;
  accessibilityLabel: string;
  isAnimating?: boolean;
}

export function ActionButton({
  icon,
  onPress,
  disabled,
  accessibilityLabel,
  isAnimating = false,
}: ActionButtonProps) {
  const themeColors = useThemeColors();
  const styles = useStyles();
  const prefersReducedMotion = useReducedMotion();
  const rotation = useSharedValue(0);

  useEffect(() => {
    if (!isAnimating || prefersReducedMotion) {
      rotation.value = withTiming(0, { duration: 120 });
      return;
    }

    rotation.value = withRepeat(
      withTiming(360, { duration: 900, easing: Easing.linear }),
      -1,
      false,
    );
  }, [isAnimating, prefersReducedMotion, rotation]);

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      hitSlop={spacing[2]}
      style={({ pressed }) => [
        styles.actionBtn,
        disabled ? styles.actionBtnDisabled : null,
        pressed && !disabled ? styles.actionBtnPressed : null,
      ]}
    >
      <Animated.View style={iconStyle}>
        <AppIcon
          name={icon}
          size={BTN_ICON_SIZE}
          tintColor={disabled ? themeColors['text-tertiary'] : themeColors.white}
        />
      </Animated.View>
    </Pressable>
  );
}

const useStyles = makeStyles((theme) => ({
  actionBtn: {
    width: BTN_SIZE,
    height: BTN_SIZE,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnDisabled: {
    opacity: 0.5,
  },
  actionBtnPressed: {
    opacity: 0.7,
  },
}));
