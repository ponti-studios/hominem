import React, { useCallback, useMemo } from 'react';
import {
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  useColorScheme,
  ViewStyle,
  type PressableStateCallbackType,
} from 'react-native';

import { componentSizes, fontSizes, fontWeights, radii, themeSpacing } from '~/components/theme';

interface ButtonProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  size?: 'sm' | 'md';
  variant?: 'primary' | 'secondary' | 'tertiary' | 'destructive-text';
  testID?: string;
}

export function Button({
  label,
  onPress,
  disabled = false,
  size = 'md',
  variant = 'primary',
  testID,
}: ButtonProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const resolvedStyles = useMemo(() => {
    const baseStyle = {
      paddingVertical: themeSpacing.md,
      paddingHorizontal: themeSpacing.lg,
      borderRadius: radii.md,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      alignSelf: 'stretch' as const,
      height: componentSizes.xl,
    };

    const variantStyles: Record<string, StyleProp<ViewStyle>> = {
      primary: {
        backgroundColor: isDark ? '#FFFFFF' : '#000000',
        borderWidth: 0,
      },
      secondary: {
        backgroundColor: 'transparent',
        borderWidth: 1,
        borderColor: isDark ? '#FFFFFF' : '#000000',
      },
      tertiary: {
        backgroundColor: 'transparent',
        borderWidth: 0,
      },
      'destructive-text': {
        backgroundColor: 'transparent',
        borderRadius: radii.md,
      },
    };

    const textColor = {
      primary: isDark ? '#000000' : '#FFFFFF',
      secondary: isDark ? '#FFFFFF' : '#000000',
      tertiary: isDark ? '#FFFFFF' : '#000000',
      'destructive-text': 'red',
    };

    return {
      container: [baseStyle, variantStyles[variant], disabled && styles.disabled],
      text: textColor[variant],
    };
  }, [disabled, isDark, variant]);

  const pressableStyle = useCallback(
    ({ pressed }: PressableStateCallbackType) => [
      resolvedStyles.container,
      pressed && !disabled && styles.pressed,
    ],
    [disabled, resolvedStyles.container],
  );

  return (
    <Pressable testID={testID} onPress={onPress} disabled={disabled} style={pressableStyle}>
      <Text
        style={[
          styles.text,
          size === 'sm' && styles.textSm,
          {
            color: resolvedStyles.text,
            opacity: disabled ? 0.5 : 1,
          },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  text: {
    fontSize: fontSizes.md,
    fontWeight: fontWeights.semibold,
  },
  textSm: {
    fontSize: fontSizes.footnote,
  },
  pressed: {
    opacity: 0.7,
  },
  disabled: {
    opacity: 0.5,
  },
});
