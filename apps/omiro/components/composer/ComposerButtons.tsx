import type { SFSymbol } from 'expo-symbols';
import React from 'react';
import { Pressable } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useDerivedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { makeStyles, spacing, useThemeColors } from '~/components/theme';
import AppIcon from '~/components/ui/icon';
import { useReducedMotion } from '~/hooks/use-reduced-motion';

const BTN_SIZE = spacing[6]; // 32px
const BTN_ICON_SIZE = spacing[4] + 2; // 18px

export type ActionButtonVariant = 'default' | 'primary' | 'muted';

interface ActionButtonProps {
  icon: SFSymbol;
  onPress: () => void;
  disabled: boolean;
  accessibilityLabel: string;
  isAnimating?: boolean;
  testID?: string;
  variant?: ActionButtonVariant;
}

export function ActionButton({
  icon,
  onPress,
  disabled,
  accessibilityLabel,
  isAnimating = false,
  testID,
  variant = 'default',
}: ActionButtonProps) {
  const themeColors = useThemeColors();
  const styles = useStyles();
  const prefersReducedMotion = useReducedMotion();
  const rotation = useDerivedValue(() => {
    if (!isAnimating || prefersReducedMotion) {
      return withTiming(0, { duration: 120 });
    }

    return withRepeat(withTiming(360, { duration: 900, easing: Easing.linear }), -1, false);
  }, [isAnimating, prefersReducedMotion]);

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  const iconTintColor = disabled
    ? themeColors['text-tertiary']
    : variant === 'primary'
      ? themeColors['bg-base']
      : variant === 'muted'
        ? themeColors['text-secondary']
        : themeColors.white;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      hitSlop={spacing[2]}
      testID={testID}
      style={({ pressed }) => [
        styles.actionBtn,
        variant === 'primary' && !disabled ? styles.actionBtnPrimary : null,
        disabled ? styles.actionBtnDisabled : null,
        pressed && !disabled ? styles.actionBtnPressed : null,
      ]}
    >
      <Animated.View style={iconStyle}>
        <AppIcon name={icon} size={BTN_ICON_SIZE} tintColor={iconTintColor} />
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
  actionBtnPrimary: {
    backgroundColor: theme.colors.foreground,
    borderRadius: BTN_SIZE / 2,
  },
  actionBtnDisabled: {
    opacity: 0.5,
  },
  actionBtnPressed: {
    opacity: 0.7,
  },
}));
