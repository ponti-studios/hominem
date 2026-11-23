import type { SymbolViewProps } from 'expo-symbols';
import { Modal, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppTheme, useStyles, withAlpha } from '~/components/theme';
import { Glass } from '~/components/ui/glass';
import AppIcon from '~/components/ui/icon';
import { PressableScale } from '~/components/ui/pressable-scale';

type IconName = SymbolViewProps['name'];

interface ActionSheetOption {
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
// options with a separate Cancel pill, over a dimmed page. Both are glass, so
// the menu matches the bar it opens from.
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
    backdrop: { flex: 1, backgroundColor: withAlpha(theme.colors.overlayScrim, 0.3) },
    wrap: { position: 'absolute', left: 12, right: 12, bottom: Math.max(bottom, 12) + 10 },
    card: { overflow: 'hidden' },
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
    cancelWrap: { marginTop: 10 },
    cancel: {
      height: 60,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cancelLabel: { color: theme.colors.barAccent, fontSize: 18, fontWeight: '800' },
  }));

  return (
    <Modal animationType="fade" onRequestClose={onClose} transparent visible={visible}>
      <Pressable accessibilityLabel={cancelLabel} onPress={onClose} style={styles.backdrop} />
      <View style={styles.wrap} testID={testID}>
        <Glass radius="2xl" style={styles.card}>
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
        </Glass>
        <PressableScale
          accessibilityRole="button"
          onPress={onClose}
          style={styles.cancelWrap}
          testID={testID ? `${testID}-cancel` : undefined}
        >
          <Glass interactive radius="2xl" style={styles.cancel}>
            <Text style={styles.cancelLabel}>{cancelLabel}</Text>
          </Glass>
        </PressableScale>
      </View>
    </Modal>
  );
}
