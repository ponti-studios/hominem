import { Pressable, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown, useReducedMotion } from 'react-native-reanimated';

import { useAppTheme, useStyles } from '~/components/theme';
import AppIcon from '~/components/ui/icon';

export interface TimeToastModel {
  action?: { label: string; onPress: () => void };
  badge?: string;
  detail?: string;
  id: number;
  message: string;
  tone: 'error' | 'success';
}

interface TimeToastProps {
  bottom: number;
  onDismiss: () => void;
  toast: TimeToastModel;
}

// Transient feedback floating above the capture bar. Success is the inverted
// ink pill with a lime badge; errors are a bordered card with a coral icon
// and a retry.
export function TimeToast({ bottom, onDismiss, toast }: TimeToastProps) {
  const reducedMotion = useReducedMotion();
  const { primaryForeground } = useAppTheme().colors;
  const isError = toast.tone === 'error';
  const styles = useStyles((theme) => ({
    toast: {
      alignItems: 'center',
      backgroundColor: isError ? theme.colors.card : theme.colors.ink,
      borderColor: theme.colors.coral,
      borderCurve: 'continuous',
      borderRadius: 26,
      borderWidth: isError ? 2 : 0,
      bottom,
      boxShadow: theme.shadows.float,
      flexDirection: 'row',
      gap: 14,
      left: 16,
      paddingHorizontal: 18,
      paddingVertical: 14,
      position: 'absolute',
      right: 16,
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
      color: isError ? theme.colors.foreground : theme.colors.inkForeground,
    },
    detail: {
      ...theme.textVariants.footnote,
      color: isError ? theme.colors.mutedForeground : theme.colors.inkForeground,
      opacity: isError ? 1 : 0.7,
    },
    action: {
      ...theme.textVariants.subhead,
      color: isError ? theme.colors.primary : theme.colors.lime,
      fontWeight: '700',
    },
  }));

  return (
    <Animated.View
      accessibilityLiveRegion="polite"
      entering={reducedMotion ? undefined : FadeInDown.springify().damping(18)}
      exiting={reducedMotion ? undefined : FadeOutDown.duration(160)}
      style={styles.toast}
      testID={isError ? 'time-error-toast' : 'time-success-toast'}
    >
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
    </Animated.View>
  );
}
