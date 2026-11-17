import type { ReactNode } from 'react';
import { StyleSheet, Text, View, type TextStyle, type ViewStyle } from 'react-native';

/** The shared form pieces: a grouped card and its footnote. Apps pass their own colors. */
export type FormColors = {
  card: string;
  border: string;
  mutedForeground: string;
};

/** A rounded, hairline-bordered card that holds a set of rows, the way system Settings groups them. */
export function FormGroup({
  colors,
  children,
  accessibilityRole,
  accessibilityLabel,
  style,
}: {
  colors: Pick<FormColors, 'card' | 'border'>;
  children: ReactNode;
  accessibilityRole?: 'radiogroup' | 'list';
  accessibilityLabel?: string;
  style?: ViewStyle;
}) {
  return (
    <View
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      style={[styles.group, { backgroundColor: colors.card, borderColor: colors.border }, style]}
    >
      {children}
    </View>
  );
}

/** The explanation under a group of rows. */
export function FormFooter({
  text,
  colors,
  style,
}: {
  text: string;
  colors: Pick<FormColors, 'mutedForeground'>;
  style?: TextStyle;
}) {
  return <Text style={[styles.footer, { color: colors.mutedForeground }, style]}>{text}</Text>;
}

const styles = StyleSheet.create({
  group: { borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  footer: { fontSize: 12.5, lineHeight: 18 },
});
