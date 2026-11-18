import { Pressable, Text, View } from 'react-native';
import Animated, { FadeOutUp, useReducedMotion } from 'react-native-reanimated';

import { useAppTheme, useStyles } from '~/components/theme';
import { Glass } from '~/components/ui/glass';
import AppIcon from '~/components/ui/icon';
import { glassPopIn } from '~/services/motion/native-motion';

export interface TimeToastModel {
  action?: { label: string; onPress: () => void };
  badge?: string;
  detail?: string;
  id: number;
  message: string;
  tone: 'error' | 'success';
}

interface TimeToastProps {
  // Distance from the top edge of the screen's content area.
  top: number;
  onDismiss: () => void;
  toast: TimeToastModel;
}

// Transient feedback floating above the capture bar, on glass. Success has a
// lime badge; errors a coral ring, a coral icon and a retry.
export function TimeToast({ onDismiss, toast, top }: TimeToastProps) {
  const reducedMotion = useReducedMotion();
  const { primaryForeground } = useAppTheme().colors;
  const isError = toast.tone === 'error';
  const styles = useStyles((theme) => ({
    toast: { left: 16, position: 'absolute', right: 16, top },
    surface: {
      alignItems: 'center',
      borderColor: theme.colors.coral,
      borderWidth: isError ? 2 : 0,
      flexDirection: 'row',
      gap: 14,
      paddingHorizontal: 18,
      paddingVertical: 14,
    },
    badge: {
      alignItems: 'center',
      backgroundColor: isError ? theme.colors.coral : theme.colors.lime,
      borderRadius: 24,
      height: 48,
      justifyContent: 'center',
      width: 48,
    },
    badgeText: {
      ...theme.textVariants.subhead,
      color: theme.colors.limeForeground,
      fontWeight: '700',
    },
    body: { flex: 1, gap: 1 },
    message: {
      ...theme.textVariants.headline,
      color: theme.colors.barForeground,
    },
    detail: {
      ...theme.textVariants.footnote,
      color: theme.colors.barForeground,
      opacity: 0.7,
    },
    action: {
      ...theme.textVariants.subhead,
      color: theme.colors.primaryText,
      fontWeight: '700',
    },
  }));

  return (
    <Animated.View
      accessibilityLiveRegion="polite"
      entering={reducedMotion ? undefined : glassPopIn}
      exiting={reducedMotion ? undefined : FadeOutUp.duration(160)}
      style={styles.toast}
      testID={isError ? 'time-error-toast' : 'time-success-toast'}
    >
      <Glass radius="xl" style={styles.surface}>
        <View style={styles.badge}>
          {isError ? (
            <AppIcon name="wifi.slash" size={22} tintColor={primaryForeground} />
          ) : (
            <Text style={styles.badgeText}>{toast.badge ?? ''}</Text>
          )}
        </View>
        <View style={styles.body}>
          <Text numberOfLines={2} style={styles.message}>
            {toast.message}
          </Text>
          {toast.detail ? (
            <Text numberOfLines={1} style={styles.detail}>
              {toast.detail}
            </Text>
          ) : null}
        </View>
        {toast.action ? (
          <Pressable
            accessibilityRole="button"
            hitSlop={10}
            onPress={() => {
              toast.action?.onPress();
              onDismiss();
            }}
            testID="time-toast-action"
          >
            <Text style={styles.action}>{toast.action.label}</Text>
          </Pressable>
        ) : null}
        {isError ? (
          <Pressable
            accessibilityLabel="Dismiss"
            accessibilityRole="button"
            hitSlop={10}
            onPress={onDismiss}
            testID="time-toast-dismiss"
          >
            <AppIcon name="xmark" size={16} />
          </Pressable>
        ) : null}
      </Glass>
    </Animated.View>
  );
}
