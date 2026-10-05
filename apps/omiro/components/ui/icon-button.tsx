import type { ReactNode } from 'react';
import { Pressable, type StyleProp, type ViewStyle } from 'react-native';

import { useStyles } from '~/components/theme';

interface IconButtonProps {
  accessibilityLabel?: string;
  children: ReactNode;
  disabled?: boolean;
  onPress?: () => void;
  onPressIn?: () => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'bordered' | 'plain' | 'solid' | 'tonal' | 'ink';
}

export function IconButton({
  accessibilityLabel,
  children,
  disabled = false,
  onPress,
  onPressIn,
  size = 'sm',
  style,
  testID,
  variant = 'bordered',
}: IconButtonProps) {
  const styles = useStyles((currentTheme) => ({
    button: {
      borderRadius: currentTheme.borderRadii.pill,
      alignItems: 'center',
      justifyContent: 'center',
    } satisfies ViewStyle,
    bordered: { borderWidth: 1, borderColor: currentTheme.colors.border } satisfies ViewStyle,
    sm: { width: 32, height: 32 } satisfies ViewStyle,
    md: { width: 44, height: 44 } satisfies ViewStyle,
    lg: { width: 48, height: 48 } satisfies ViewStyle,
    tonal: { borderWidth: 0, backgroundColor: currentTheme.colors.card } satisfies ViewStyle,
    ink: { borderWidth: 0, backgroundColor: currentTheme.colors.ink } satisfies ViewStyle,
    plain: { borderWidth: 0, borderColor: 'transparent' } satisfies ViewStyle,
    solid: {
      borderWidth: 0,
      backgroundColor: currentTheme.colors.primary,
    } satisfies ViewStyle,
    pressed: { opacity: 0.7 } satisfies ViewStyle,
    disabled: { opacity: 0.4 } satisfies ViewStyle,
  }));
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      onPressIn={onPressIn}
      style={({ pressed }) => [
        styles.button,
        styles[size],
        styles[variant],
        style,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
      testID={testID}
    >
      {children}
    </Pressable>
  );
}
