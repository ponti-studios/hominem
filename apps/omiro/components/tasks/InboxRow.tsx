import { Pressable, Text, View } from 'react-native';

import { useAppTheme, useStyles } from '~/components/theme';
import AppIcon from '~/components/ui/icon';

interface InboxRowProps {
  count: number;
  onPress: () => void;
}

// The only trace of undated tasks on the Tasks tab: a count that opens triage.
export function InboxRow({ count, onPress }: InboxRowProps) {
  const { eventForeground, mutedForeground } = useAppTheme().colors;
  const styles = useStyles((theme) => ({
    row: {
      alignItems: 'center',
      backgroundColor: theme.colors.eventViolet,
      borderCurve: 'continuous',
      borderRadius: theme.borderRadii.xl,
      flexDirection: 'row',
      gap: 12,
      minHeight: 56,
      paddingHorizontal: 16,
      paddingVertical: 10,
    },
    tile: {
      alignItems: 'center',
      backgroundColor: theme.colors.card,
      borderCurve: 'continuous',
      borderRadius: 12,
      height: 36,
      justifyContent: 'center',
      width: 36,
    },
    label: { ...theme.textVariants.headline, color: theme.colors.eventForeground, flex: 1 },
  }));
  return (
    <Pressable
      accessibilityLabel={`${count} to place`}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.85 }]}
      testID="tasks-inbox-row"
    >
      <View style={styles.tile}>
        <AppIcon name="tray" size={20} tintColor={eventForeground} />
      </View>
      <Text style={styles.label}>{`${count} to place`}</Text>
      <AppIcon name="chevron.right" size={16} tintColor={mutedForeground} />
    </Pressable>
  );
}
