import { useEffect } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown, useReducedMotion } from 'react-native-reanimated';

import { useAppTheme, useStyles } from '~/components/theme';
import AppIcon from '~/components/ui/icon';

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
  const { limeForeground, primaryForeground } = useAppTheme().colors;
  const styles = useStyles((theme) => ({
    popup: {
      alignItems: 'center',
      backgroundColor: theme.colors.ink,
      borderCurve: 'continuous',
      borderRadius: 24,
      boxShadow: theme.shadows.float,
      flexDirection: 'row',
      gap: 10,
      height: 48,
      left: 12,
      paddingHorizontal: 6,
      position: 'absolute',
      right: 12,
    },
    badge: {
      alignItems: 'center',
      backgroundColor: theme.colors.lime,
      borderRadius: 18,
      height: 36,
      justifyContent: 'center',
      width: 36,
    },
    label: { ...theme.textVariants.subhead, color: theme.colors.inkForeground, flex: 1 },
    open: {
      alignItems: 'center',
      backgroundColor: theme.colors.primary,
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
      entering={reducedMotion ? undefined : FadeInDown.springify().damping(18)}
      exiting={reducedMotion ? undefined : FadeOutDown.duration(160)}
      style={[styles.popup, { bottom }]}
      testID="saved-popup"
    >
      <View style={styles.badge}>
        <AppIcon name="note.text" size={18} tintColor={limeForeground} />
      </View>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        accessibilityLabel={`${label}. Open`}
        accessibilityRole="button"
        hitSlop={8}
        onPress={onOpen}
        style={styles.open}
        testID="saved-popup-open"
      >
        <AppIcon name="arrow.right" size={16} tintColor={primaryForeground} />
      </Pressable>
    </Animated.View>
  );
}
