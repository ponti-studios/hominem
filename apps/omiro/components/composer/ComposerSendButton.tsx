import type { SFSymbol } from 'expo-symbols';
import { ActivityIndicator, Pressable } from 'react-native';

import { useAppTheme, useStyles } from '~/components/theme';
import AppIcon from '~/components/ui/icon';

interface ComposerSendButtonProps {
  accessibilityLabel: string;
  disabled?: boolean;
  icon: SFSymbol;
  isLoading?: boolean;
  onPress: () => void;
  testID?: string;
}

// Filled circular primary action -- distinct from the plain/bordered
// IconButton so it reads as *the* primary action (send, or the enhance
// sheet's accept checkmark), not just another control among equals. Icon is
// a prop so it's reusable anywhere that needs this shape.
export function ComposerSendButton({
  accessibilityLabel,
  disabled = false,
  icon,
  isLoading = false,
  onPress,
  testID,
}: ComposerSendButtonProps) {
  const { primary, primaryForeground } = useAppTheme().colors;
  const styles = useStyles(() => ({
    sendButton: {
      width: 32,
      height: 32,
      borderRadius: 999,
      alignItems: 'center',
      justifyContent: 'center',
    },
  }));

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      disabled={disabled || isLoading}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [
        styles.sendButton,
        { backgroundColor: primary },
        pressed && { opacity: 0.8 },
        (disabled || isLoading) && { opacity: 0.4 },
      ]}
    >
      {isLoading ? (
        <ActivityIndicator color={primaryForeground} size="small" />
      ) : (
        <AppIcon name={icon} size={16} tintColor={primaryForeground} />
      )}
    </Pressable>
  );
}
