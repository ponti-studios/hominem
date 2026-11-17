import type { ReactNode } from 'react';
import { type StyleProp, type ViewStyle } from 'react-native';

import { useStyles } from '~/components/theme';

import { Glass } from './glass';
import { PressableScale } from './pressable-scale';

interface IconButtonProps {
  accessibilityLabel?: string;
  children: ReactNode;
  disabled?: boolean;
  onPress?: () => void;
  onPressIn?: () => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  size?: 'sm' | 'md' | 'lg';
  // `glass` floats over content (header buttons); the rest sit on a surface.
  variant?: 'bordered' | 'plain' | 'solid' | 'tonal' | 'ink' | 'glass';
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
    glass: { borderWidth: 0 } satisfies ViewStyle,
    fill: { alignItems: 'center', flex: 1, justifyContent: 'center' } satisfies ViewStyle,
  }));
  return (
    <PressableScale
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      onPressIn={onPressIn}
      style={[styles.button, styles[size], styles[variant], style]}
      testID={testID}
    >
      {variant === 'glass' ? (
        <Glass interactive style={[styles.fill, { alignSelf: 'stretch' }]}>
          {children}
        </Glass>
      ) : (
        children
      )}
    </PressableScale>
  );
}
