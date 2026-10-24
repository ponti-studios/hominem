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
  // Float over the content instead of sitting above it: the screen's scroll view runs under the
  // buttons and a fade keeps the status bar legible. The screen pads its content by
  // `useFloatingHeaderHeight()` so the first row starts clear of the buttons.
  overlay?: boolean;
}

const BAR_PADDING_TOP = 4;
const BAR_PADDING_BOTTOM = 8;
const BUTTON_SIZE = 48;

export function useFloatingHeaderHeight() {
  const { top } = useSafeAreaInsets();
  return top + BAR_PADDING_TOP + BUTTON_SIZE + BAR_PADDING_BOTTOM;
}

// The detail screens' top bar: a white circle on the left and a white pill of
// actions on the right, floating over the page background. It sits in the
// layout flow (not over the content) so lists never scroll under it.
export function FloatingHeader({ left, right, overlay = false }: FloatingHeaderProps) {
  const { top } = useSafeAreaInsets();
  const height = useFloatingHeaderHeight();
  const styles = useStyles((theme) => ({
    bar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingTop: top + BAR_PADDING_TOP,
      paddingBottom: BAR_PADDING_BOTTOM,
    },
    overlayBar: { position: 'absolute', top: 0, right: 0, left: 0, zIndex: 10 },
    // Solid page colour behind the status bar, easing out below the buttons.
    fade: {
      position: 'absolute',
      top: 0,
      right: 0,
      left: 0,
      height: height + 16,
      experimental_backgroundImage: `linear-gradient(to bottom, ${theme.colors.background} 0%, ${theme.colors.background} ${Math.round((top / (height + 16)) * 100)}%, ${theme.colors.background}00 100%)`,
    },
  }));
  return (
    <View pointerEvents="box-none" style={overlay ? styles.overlayBar : undefined}>
      {overlay ? <View pointerEvents="none" style={styles.fade} /> : null}
      <View style={styles.bar}>
        <View>{left}</View>
        <View>{right}</View>
      </View>
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
