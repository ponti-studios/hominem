import type { SFSymbol } from 'expo-symbols';
import { Pressable, Text, View } from 'react-native';

import { useAppTheme, useStyles } from '~/components/theme';
import AppIcon from '~/components/ui/icon';

// Shared row primitive for task/event field editors (TimeDraftResult, TimeBlockDetail):
// icon badge + label + value, tappable to reveal an inline editor below it.
export function FieldRow({
  active = false,
  editable = false,
  icon,
  label,
  muted = false,
  onPress,
  testID,
  value,
}: {
  active?: boolean;
  editable?: boolean;
  icon: SFSymbol;
  label: string;
  muted?: boolean;
  onPress?: () => void;
  testID?: string;
  value: string | null;
}) {
  const { mutedForeground, primaryForeground } = useAppTheme().colors;
  const styles = useStyles((theme) => ({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 9,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
    },
    iconWrap: {
      width: 26,
      height: 26,
      borderRadius: 999,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: active ? theme.colors.primary : theme.colors.muted,
    },
    content: { flex: 1 },
    label: { ...theme.textVariants.caption2, color: theme.colors.mutedForeground },
    value: {
      ...theme.textVariants.footnote,
      color: muted ? theme.colors.mutedForeground : theme.colors.foreground,
    },
  }));
  if (!value) {
    return null;
  }
  return (
    <Pressable
      accessibilityLabel={editable ? `Edit ${label.toLowerCase()}` : label}
      disabled={!onPress}
      onPress={onPress}
      style={styles.row}
      testID={testID}
    >
      <View style={styles.iconWrap}>
        <AppIcon name={icon} size={13} tintColor={active ? primaryForeground : undefined} />
      </View>
      <View style={styles.content}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.value}>{value}</Text>
      </View>
      {editable ? (
        <AppIcon
          name={active ? 'chevron.down' : 'chevron.right'}
          size={11}
          tintColor={mutedForeground}
        />
      ) : null}
    </Pressable>
  );
}
