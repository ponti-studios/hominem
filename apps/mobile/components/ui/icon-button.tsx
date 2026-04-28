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

import { useThemeColors } from '~/components/theme';

import AppIcon from './icon';

export interface AppIconButtonProps extends Omit<PressableProps, 'children' | 'onPress' | 'style'> {
  accessibilityLabel: string;
  icon: SFSymbol;
  iconSize?: number;
  size?: number;
  tintColor?: ColorValue;
  disabledOpacity?: number;
  pressedOpacity?: number;
  onPress?: (event: GestureResponderEvent) => void;
  style?: StyleProp<ViewStyle>;
}

export function AppIconButton({
  accessibilityLabel,
  accessibilityRole = 'button',
  disabled = false,
  disabledOpacity = 0.35,
  hitSlop = 8,
  icon,
  iconSize = 18,
  onPress,
  pressedOpacity = 0.65,
  size = 32,
  style,
  tintColor,
  ...rest
}: AppIconButtonProps) {
  const themeColors = useThemeColors();

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
        style,
        disabled ? { opacity: disabledOpacity } : pressed ? { opacity: pressedOpacity } : null,
      ]}
      {...rest}
    >
      <AppIcon name={icon} size={iconSize} tintColor={tintColor ?? themeColors['icon-primary']} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
