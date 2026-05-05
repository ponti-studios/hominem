import type { SFSymbol } from 'expo-symbols';
import React from 'react';
import type {
  ColorValue,
  GestureResponderEvent,
  PressableProps,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { Pressable, StyleSheet } from 'react-native';

import { componentSizes, themeSpacing, useThemeColors } from '~/components/theme';

import AppIcon from './icon';

export type IconButtonVariant = 'ghost' | 'filled';

const FILLED_BACKGROUND = 'rgba(0, 0, 0, 0.9)';

export interface IconButtonProps extends Omit<PressableProps, 'children' | 'onPress' | 'style'> {
  accessibilityLabel: string;
  icon: SFSymbol;
  iconSize?: number;
  size?: number;
  variant?: IconButtonVariant;
  circular?: boolean;
  tintColor?: ColorValue;
  disabledOpacity?: number;
  pressedOpacity?: number;
  onPress?: (event: GestureResponderEvent) => void;
  style?: StyleProp<ViewStyle>;
}

export function IconButton({
  accessibilityLabel,
  accessibilityRole = 'button',
  circular = false,
  disabled = false,
  disabledOpacity = 0.35,
  hitSlop = themeSpacing.sm,
  icon,
  iconSize = componentSizes.md,
  onPress,
  pressedOpacity = 0.65,
  size = componentSizes.lg,
  style,
  tintColor,
  variant,
  ...rest
}: IconButtonProps) {
  const themeColors = useThemeColors();

  const resolvedTintColor =
    tintColor ??
    (variant === 'ghost'
      ? themeColors['text-primary']
      : variant === 'filled'
        ? themeColors['white']
        : themeColors['icon-primary']);

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={accessibilityRole}
      disabled={disabled}
      hitSlop={hitSlop}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { height: size, width: size },
        variant === 'filled' ? { backgroundColor: FILLED_BACKGROUND } : null,
        circular ? { borderRadius: size / 2 } : null,
        style,
        disabled ? { opacity: disabledOpacity } : pressed ? { opacity: pressedOpacity } : null,
      ]}
      {...rest}
    >
      <AppIcon name={icon} size={iconSize} tintColor={resolvedTintColor} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
