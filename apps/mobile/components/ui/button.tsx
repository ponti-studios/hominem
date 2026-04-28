import React, { useCallback, useMemo } from 'react';
import {
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  useColorScheme,
  type PressableStateCallbackType,
} from 'react-native';

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
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 10,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      alignSelf: 'stretch' as const,
      height: 44,
    };

    const variantStyles: Record<string, StyleProp<TextStyle>> = {
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
        borderRadius: 10,
        fontWeight: '300',
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
    fontSize: 16,
    fontWeight: '600',
  },
  textSm: {
    fontSize: 13,
  },
  pressed: {
    opacity: 0.7,
  },
  disabled: {
    opacity: 0.5,
  },
});
