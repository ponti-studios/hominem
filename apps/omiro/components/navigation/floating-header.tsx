import type { SymbolViewProps } from 'expo-symbols';
import type { ReactNode } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useStyles } from '~/components/theme';
import { IconButton } from '~/components/ui';
import AppIcon from '~/components/ui/icon';

type IconName = SymbolViewProps['name'];

interface FloatingHeaderProps {
  left?: ReactNode;
  right?: ReactNode;
}

// The detail screens' top bar: a white circle on the left and a white pill of
// actions on the right, floating over the page background. It sits in the
// layout flow (not over the content) so lists never scroll under it.
export function FloatingHeader({ left, right }: FloatingHeaderProps) {
  const { top } = useSafeAreaInsets();
  const styles = useStyles(() => ({
    bar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingTop: top + 4,
      paddingBottom: 8,
    },
  }));
  return (
    <View style={styles.bar}>
      <View>{left}</View>
      <View>{right}</View>
    </View>
  );
}

interface FloatingIconButtonProps {
  accessibilityLabel: string;
  icon: IconName;
  onPress: () => void;
  testID?: string;
}

// One 48pt white circle -- the back / close button.
export function FloatingCircleButton({
  accessibilityLabel,
  icon,
  onPress,
  testID,
}: FloatingIconButtonProps) {
  const styles = useStyles((theme) => ({
    circle: { boxShadow: theme.shadows.float },
  }));
  return (
    <IconButton
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      size="lg"
      style={styles.circle}
      testID={testID}
      variant="tonal"
    >
      <AppIcon name={icon} size={22} />
    </IconButton>
  );
}

// A white pill that groups the screen's action buttons (and any status chip).
export function FloatingActionPill({ children }: { children: ReactNode }) {
  const styles = useStyles((theme) => ({
    pill: {
      flexDirection: 'row',
      alignItems: 'center',
      height: 48,
      paddingHorizontal: 4,
      borderRadius: theme.borderRadii.pill,
      backgroundColor: theme.colors.card,
      boxShadow: theme.shadows.float,
    },
  }));
  return <View style={styles.pill}>{children}</View>;
}

export function FloatingPillButton({
  accessibilityLabel,
  icon,
  onPress,
  testID,
}: FloatingIconButtonProps) {
  return (
    <IconButton
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      size="lg"
      testID={testID}
      variant="plain"
    >
      <AppIcon name={icon} size={22} />
    </IconButton>
  );
}
