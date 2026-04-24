import type { SFSymbol } from 'expo-symbols';
import React from 'react';
import { Pressable, type StyleProp, type ViewStyle } from 'react-native';

import { spacing } from '~/components/theme';
import { useThemeColors } from '~/components/theme/theme';

import AppIcon from './icon';

interface IconButtonProps {
  accessibilityLabel: string;
  icon: SFSymbol;
  iconSize?: number;
  disabled?: boolean;
  onPress: () => void;
  size?: number;
  style?: StyleProp<ViewStyle>;
}

export function IconButton({
  accessibilityLabel,
  disabled = false,
  icon,
  iconSize = 20,
  onPress,
  size = 26,
  style,
}: IconButtonProps) {
  const themeColors = useThemeColors();

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      disabled={disabled}
      hitSlop={spacing[2]}
      onPress={onPress}
      style={({ pressed }) => [
        {
          width: size,
          height: size,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 8,
          opacity: disabled ? 0.4 : 1,
          backgroundColor: pressed ? themeColors['bg-surface'] : 'transparent',
        },
        style,
      ]}
    >
      <AppIcon name={icon} size={iconSize} color={themeColors['text-secondary']} />
    </Pressable>
  );
}
