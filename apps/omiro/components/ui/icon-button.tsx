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
  variant?: 'bordered' | 'plain' | 'solid';
}

export function IconButton({
  accessibilityLabel,
  children,
  disabled = false,
  onPress,
  onPressIn,
  style,
  testID,
  variant = 'bordered',
}: IconButtonProps) {
  const styles = useStyles((currentTheme) => ({
    button: {
      width: 32,
      height: 32,
      borderRadius: 999,
      alignItems: 'center',
      justifyContent: 'center',
    } satisfies ViewStyle,
    bordered: { borderWidth: 1, borderColor: currentTheme.colors.border } satisfies ViewStyle,
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
        variant === 'plain' ? styles.plain : variant === 'solid' ? styles.solid : styles.bordered,
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
