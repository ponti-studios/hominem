import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, Text, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';

import { useHaptics } from '~/hooks/useHaptics';
import theme from '~/components/theme/theme';

interface ButtonProps {
  title?: string;
  children?: ReactNode;
  onPress?: () => void | Promise<void>;
  disabled?: boolean;
  isLoading?: boolean;
  variant?: 'primary' | 'outline' | 'ghost' | 'link' | 'default';
  size?: 'xs' | 'sm' | 'md' | 'default';
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  testID?: string;
  accessibilityLabel?: string;
}

function resolveContainerStyle(variant: NonNullable<ButtonProps['variant']>): ViewStyle {
  switch (variant) {
    case 'link':
      return { paddingHorizontal: 0, paddingVertical: 4, backgroundColor: 'transparent' };
    case 'outline':
      return {
        backgroundColor: theme.colors.background,
        borderWidth: 1,
        borderColor: theme.colors['border-default'],
      };
    case 'ghost':
      return { backgroundColor: 'transparent' };
    case 'default':
    case 'primary':
    default:
      return { backgroundColor: theme.colors.foreground };
  }
}

function resolveTextStyle(variant: NonNullable<ButtonProps['variant']>): TextStyle {
  switch (variant) {
    case 'link':
      return {
        color: theme.colors['text-secondary'],
        fontSize: 12,
        fontWeight: '600',
        textDecorationLine: 'underline',
      };
    case 'outline':
    case 'ghost':
      return { color: theme.colors.foreground, fontSize: 14, fontWeight: '600' };
    case 'default':
    case 'primary':
    default:
      return { color: theme.colors.background, fontSize: 14, fontWeight: '600' };
  }
}

export function Button({
  title,
  children,
  onPress,
  disabled = false,
  isLoading = false,
  variant = 'primary',
  size = 'md',
  style,
  textStyle,
  testID,
  accessibilityLabel,
}: ButtonProps) {
  const compact = size === 'xs';
  const { impact } = useHaptics();

  const handlePress = () => {
    void impact();
    onPress?.();
  };

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      disabled={disabled || isLoading}
      onPress={handlePress}
      testID={testID}
      style={({ pressed }) => [
        {
          minHeight: compact ? 28 : 44,
          borderRadius: 999,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: compact ? 8 : 16,
          paddingVertical: compact ? 4 : 10,
          opacity: disabled || isLoading ? 0.5 : pressed ? 0.85 : 1,
        },
        resolveContainerStyle(variant),
        style,
      ]}
    >
      {isLoading ? (
        <ActivityIndicator color={variant === 'link' ? theme.colors['text-secondary'] : theme.colors.background} />
      ) : typeof children === 'string' || title ? (
        <Text style={[resolveTextStyle(variant), textStyle]}>{children ?? title}</Text>
      ) : (
        children
      )}
    </Pressable>
  );
}
