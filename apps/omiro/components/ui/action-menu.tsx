import type { SymbolViewProps } from 'expo-symbols';
import { useCallback } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppTheme, useStyles, withAlpha } from '~/components/theme';
import AppIcon from '~/components/ui/icon';

type IconName = SymbolViewProps['name'];

export interface ActionMenuItem {
  key: string;
  label: string;
  icon: IconName;
  onPress: () => void;
  destructive?: boolean;
  disabled?: boolean;
  // Renders a check next to a toggle that is currently on.
  isOn?: boolean;
}

export interface ActionMenuSection {
  key: string;
  title?: string;
  items: ActionMenuItem[];
}

interface ActionMenuProps {
  visible: boolean;
  onClose: () => void;
  sections: ActionMenuSection[];
  testID?: string;
}

// The designed replacement for the native UIMenu: a white card anchored under
// the header's action pill, over a dimmed page. Picking an item closes the
// menu first, then runs the action.
export function ActionMenu({ visible, onClose, sections, testID }: ActionMenuProps) {
  const { top } = useSafeAreaInsets();
  const { destructive } = useAppTheme().colors;
  const styles = useStyles((theme) => ({
    backdrop: { flex: 1, backgroundColor: withAlpha(theme.colors.overlayScrim, 0.45) },
    card: {
      position: 'absolute',
      right: 16,
      top: top + 60,
      width: 250,
      maxHeight: '70%',
      borderRadius: 24,
      paddingBottom: 8,
      overflow: 'hidden',
      backgroundColor: theme.colors.popover,
      boxShadow: theme.shadows.float,
    },
    sectionTitle: {
      paddingHorizontal: 20,
      paddingTop: 12,
      paddingBottom: 4,
      color: theme.colors.mutedForeground,
      fontSize: 12,
      fontWeight: '800',
      letterSpacing: 0.6,
      textTransform: 'uppercase',
    },
    row: {
      height: 52,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      paddingHorizontal: 20,
    },
    rowPressed: { backgroundColor: theme.colors.secondary },
    rowDisabled: { opacity: 0.4 },
    label: { flex: 1, color: theme.colors.foreground, fontSize: 17, fontWeight: '700' },
    destructiveLabel: { color: theme.colors.destructive },
  }));

  const select = useCallback(
    (item: ActionMenuItem) => {
      onClose();
      // Let the menu's fade finish so a follow-up sheet or alert isn't
      // presented over a modal that is still dismissing.
      setTimeout(item.onPress, 220);
    },
    [onClose],
  );

  return (
    <Modal animationType="fade" onRequestClose={onClose} transparent visible={visible}>
      <Pressable
        accessibilityLabel="Close menu"
        onPress={onClose}
        style={styles.backdrop}
        testID={testID ? `${testID}-backdrop` : undefined}
      />
      <View style={styles.card} testID={testID}>
        <ScrollView bounces={false}>
          {sections.map((section) => (
            <View key={section.key}>
              {section.title ? <Text style={styles.sectionTitle}>{section.title}</Text> : null}
              {section.items.map((item) => (
                <Pressable
                  accessibilityLabel={item.label}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: item.disabled, selected: item.isOn }}
                  disabled={item.disabled}
                  key={item.key}
                  onPress={() => select(item)}
                  style={({ pressed }) => [
                    styles.row,
                    pressed && styles.rowPressed,
                    item.disabled && styles.rowDisabled,
                  ]}
                  testID={testID ? `${testID}-${item.key}` : undefined}
                >
                  <AppIcon
                    name={item.icon}
                    size={22}
                    tintColor={item.destructive ? destructive : undefined}
                  />
                  <Text style={[styles.label, item.destructive && styles.destructiveLabel]}>
                    {item.label}
                  </Text>
                  {item.isOn ? <AppIcon name="checkmark" size={18} /> : null}
                </Pressable>
              ))}
            </View>
          ))}
        </ScrollView>
      </View>
    </Modal>
  );
}
