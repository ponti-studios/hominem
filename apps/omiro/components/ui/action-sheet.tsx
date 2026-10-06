import type { SymbolViewProps } from 'expo-symbols';
import { Modal, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppTheme, useStyles, withAlpha } from '~/components/theme';
import AppIcon from '~/components/ui/icon';

type IconName = SymbolViewProps['name'];

export interface ActionSheetOption {
  key: string;
  label: string;
  icon: IconName;
  onPress: () => void;
}

interface ActionSheetProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  cancelLabel: string;
  options: ActionSheetOption[];
  testID?: string;
}

// The designed replacement for ActionSheetIOS: a floating card of
// options with a separate Cancel pill, over a dimmed page. Both use the composer's
// fixed ink bar colors so the menu matches the bar it opens from.
export function ActionSheet({
  visible,
  onClose,
  title,
  cancelLabel,
  options,
  testID,
}: ActionSheetProps) {
  const { bottom } = useSafeAreaInsets();
  const { barForeground } = useAppTheme().colors;
  const styles = useStyles((theme) => ({
    backdrop: { flex: 1, backgroundColor: withAlpha(theme.colors.overlayScrim, 0.55) },
    wrap: { position: 'absolute', left: 12, right: 12, bottom: Math.max(bottom, 12) + 10 },
    card: {
      borderRadius: 28,
      overflow: 'hidden',
      backgroundColor: theme.colors.bar,
      boxShadow: theme.shadows.bar,
    },
    title: {
      padding: 16,
      textAlign: 'center',
      color: withAlpha(theme.colors.barForeground, 0.6),
      fontSize: 14,
      fontWeight: '700',
    },
    row: {
      minHeight: 60,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      paddingHorizontal: 20,
      borderTopWidth: 1,
      borderTopColor: withAlpha(theme.colors.barForeground, 0.12),
    },
    pressed: { backgroundColor: theme.colors.barControl },
    label: { color: theme.colors.barForeground, fontSize: 18, fontWeight: '700' },
    cancel: {
      marginTop: 10,
      height: 60,
      borderRadius: 28,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.bar,
      boxShadow: theme.shadows.bar,
    },
    cancelLabel: { color: theme.colors.barAccent, fontSize: 18, fontWeight: '800' },
  }));

  return (
    <Modal animationType="fade" onRequestClose={onClose} transparent visible={visible}>
      <Pressable accessibilityLabel={cancelLabel} onPress={onClose} style={styles.backdrop} />
      <View style={styles.wrap} testID={testID}>
        <View style={styles.card}>
          <Text style={styles.title}>{title}</Text>
          {options.map((option) => (
            <Pressable
              accessibilityLabel={option.label}
              accessibilityRole="button"
              key={option.key}
              onPress={() => {
                onClose();
                setTimeout(option.onPress, 220);
              }}
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
              testID={testID ? `${testID}-${option.key}` : undefined}
            >
              <AppIcon name={option.icon} size={22} tintColor={barForeground} />
              <Text style={styles.label}>{option.label}</Text>
            </Pressable>
          ))}
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={onClose}
          style={styles.cancel}
          testID={testID ? `${testID}-cancel` : undefined}
        >
          <Text style={styles.cancelLabel}>{cancelLabel}</Text>
        </Pressable>
      </View>
    </Modal>
  );
}
