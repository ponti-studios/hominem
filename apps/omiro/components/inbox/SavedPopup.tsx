import { useEffect } from 'react';
import { Text, View } from 'react-native';
import Animated, { FadeOutDown, useReducedMotion } from 'react-native-reanimated';

import { useAppTheme, useStyles } from '~/components/theme';
import { Glass } from '~/components/ui/glass';
import AppIcon from '~/components/ui/icon';
import { PressableScale } from '~/components/ui/pressable-scale';
import { glassPopIn } from '~/services/motion/native-motion';

const AUTO_DISMISS_MS = 4000;

interface SavedPopupProps {
  // Distance from the bottom of the screen to the popup's bottom edge: it
  // floats just above the composer.
  bottom: number;
  label: string;
  onDismiss: () => void;
  onOpen: () => void;
}

// One-line confirmation that a capture landed on another tab, with an arrow
// that goes there.
export function SavedPopup({ bottom, label, onDismiss, onOpen }: SavedPopupProps) {
  const reducedMotion = useReducedMotion();
  const { barAccentForeground, limeForeground } = useAppTheme().colors;
  const styles = useStyles((theme) => ({
    popup: { left: 12, position: 'absolute', right: 12 },
    surface: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 10,
      height: 48,
      paddingHorizontal: 6,
    },
    badge: {
      alignItems: 'center',
      backgroundColor: theme.colors.lime,
      borderRadius: 18,
      height: 36,
      justifyContent: 'center',
      width: 36,
    },
    label: { ...theme.textVariants.subhead, color: theme.colors.barForeground, flex: 1 },
    open: {
      alignItems: 'center',
      backgroundColor: theme.colors.barAccent,
      borderRadius: 18,
      height: 36,
      justifyContent: 'center',
      width: 36,
    },
  }));

  useEffect(() => {
    const timer = setTimeout(onDismiss, AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <Animated.View
      accessibilityLiveRegion="polite"
      entering={reducedMotion ? undefined : glassPopIn}
      exiting={reducedMotion ? undefined : FadeOutDown.duration(160)}
      style={[styles.popup, { bottom }]}
      testID="saved-popup"
    >
      <Glass style={styles.surface}>
        <View style={styles.badge}>
          <AppIcon name="note.text" size={18} tintColor={limeForeground} />
        </View>
        <Text style={styles.label}>{label}</Text>
        <PressableScale
          accessibilityLabel={`${label}. Open`}
          accessibilityRole="button"
          hitSlop={8}
          onPress={onOpen}
          style={styles.open}
          testID="saved-popup-open"
        >
          <AppIcon name="arrow.right" size={16} tintColor={barAccentForeground} />
        </PressableScale>
      </Glass>
    </Animated.View>
  );
}
