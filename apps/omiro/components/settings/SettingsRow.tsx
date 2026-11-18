import type { SFSymbol } from 'expo-symbols';
import type { ReactNode } from 'react';
import { Text, View } from 'react-native';

import { useAppTheme, useStyles } from '~/components/theme';
import AppIcon from '~/components/ui/icon';
import { PressableScale } from '~/components/ui/pressable-scale';

function useSettingsRowStyles() {
  return useStyles((theme) => ({
    row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
    rowContent: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
    labelContent: { flex: 1, gap: 2 },
    label: {},
    description: { fontSize: 13, color: theme.colors.mutedForeground },
    staticRow: { paddingHorizontal: 16 },
    pressableRow: { paddingHorizontal: 16 },
    // An inset grouped card, the way system Settings groups its rows.
    group: {
      backgroundColor: theme.colors.card,
      borderCurve: 'continuous',
      borderRadius: theme.borderRadii.xl,
      marginHorizontal: 16,
      paddingVertical: 4,
    },
    sectionLabel: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.colors.mutedForeground,
      paddingHorizontal: 32,
      textTransform: 'uppercase',
      letterSpacing: 0.4,
    },
  }));
}

export function SettingsRow({
  icon,
  label,
  description,
  onPress,
  accessory,
  destructive,
  testID,
}: {
  icon: SFSymbol;
  label: string;
  description?: string;
  onPress?: () => void;
  accessory?: ReactNode;
  destructive?: boolean;
  testID?: string;
}) {
  const {
    destructive: destructiveColor,
    foreground: textPrimaryColor,
    tertiary: tertiaryColor,
  } = useAppTheme().colors;
  const styles = useSettingsRowStyles();

  const labelColor = destructive ? destructiveColor : textPrimaryColor;

  const content = (
    <View style={[styles.row, { minHeight: 44 }]}>
      <View style={styles.rowContent}>
        <AppIcon name={icon} size={18} tintColor={destructive ? destructiveColor : tertiaryColor} />
        <View style={styles.labelContent}>
          <Text style={[styles.label, { color: labelColor }]}>{label}</Text>
          {description ? <Text style={styles.description}>{description}</Text> : null}
        </View>
      </View>
      {accessory}
    </View>
  );

  if (!onPress) {
    return (
      <View testID={testID} style={styles.staticRow}>
        {content}
      </View>
    );
  }

  return (
    <PressableScale onPress={onPress} scale={0.98} style={styles.pressableRow} testID={testID}>
      {content}
    </PressableScale>
  );
}

export function SettingsGroup({ children }: { children: ReactNode }) {
  const styles = useSettingsRowStyles();
  return <View style={styles.group}>{children}</View>;
}

export function SectionLabel({ children }: { children: string }) {
  const styles = useSettingsRowStyles();
  return <Text style={styles.sectionLabel}>{children}</Text>;
}
