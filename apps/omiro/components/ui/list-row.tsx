import type { ReactNode } from 'react';
import {
  Pressable,
  Text,
  View,
  type AccessibilityActionEvent,
  type AccessibilityActionInfo,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import { useStyles } from '~/components/theme';

interface ListRowProps {
  accessibilityActions?: AccessibilityActionInfo[];
  accessibilityLabel: string;
  actionTestID?: string;
  // Off for a fluid, whitespace-separated list (e.g. the stream) instead of
  // the default hairline-divided table row.
  divider?: boolean;
  leading?: ReactNode;
  // 'center' (default) centers the icon against the whole title+subtitle
  // block as one unit -- fine as long as the icon is meant to represent the
  // row overall. 'top' anchors both the icon and the title+subtitle block
  // to the row's top edge instead, so `leadingStyle`'s own height can line
  // the icon up with just the title line (see InboxStreamItem) -- centering
  // only the icon while the block stays centered as a whole would anchor
  // them to two different reference points and drift apart whenever the
  // row has slack height (e.g. a single-line title leaves more than a
  // 2-line title would).
  leadingAlign?: 'center' | 'top';
  leadingStyle?: StyleProp<ViewStyle>;
  onAccessibilityAction?: (event: AccessibilityActionEvent) => void;
  onLongPress?: () => void;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
  subtitle?: string | null;
  testID?: string;
  title: string;
  // Defaults to 2. Pass 1 for a single-line, "..."-truncated title.
  titleNumberOfLines?: number;
  titleStyle?: StyleProp<TextStyle>;
  trailing?: ReactNode;
}

export function ListRow({
  accessibilityActions,
  accessibilityLabel,
  actionTestID,
  divider = true,
  leading,
  leadingAlign = 'center',
  leadingStyle,
  onAccessibilityAction,
  onLongPress,
  onPress,
  style,
  subtitle,
  testID,
  title,
  titleNumberOfLines = 2,
  titleStyle,
  trailing,
}: ListRowProps) {
  const styles = useStyles((currentTheme) => ({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      minHeight: 56,
      borderBottomWidth: 1,
      borderBottomColor: currentTheme.colors.border,
      paddingHorizontal: 2,
      paddingVertical: 8,
    } satisfies ViewStyle,
    rowFlat: { borderBottomWidth: 0 } satisfies ViewStyle,
    pressed: { backgroundColor: currentTheme.colors.muted } satisfies ViewStyle,
    leading: { width: 24 } satisfies ViewStyle,
    alignTop: { alignSelf: 'flex-start' } satisfies ViewStyle,
    content: { flex: 1, gap: 2, minWidth: 0 } satisfies ViewStyle,
    title: {
      ...currentTheme.textVariants.body,
      color: currentTheme.colors.foreground,
    } satisfies TextStyle,
    subtitle: {
      ...currentTheme.textVariants.caption1,
      color: currentTheme.colors.mutedForeground,
    } satisfies TextStyle,
    trailing: { alignItems: 'center', justifyContent: 'center' } satisfies ViewStyle,
  }));
  return (
    <Pressable
      accessibilityActions={accessibilityActions}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      onAccessibilityAction={onAccessibilityAction}
      onLongPress={onLongPress}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        !divider && styles.rowFlat,
        style,
        pressed && styles.pressed,
      ]}
      testID={testID ?? actionTestID}
    >
      {leading ? (
        <View style={[styles.leading, leadingAlign === 'top' && styles.alignTop, leadingStyle]}>
          {leading}
        </View>
      ) : null}
      <View style={[styles.content, leadingAlign === 'top' && styles.alignTop]}>
        <Text
          ellipsizeMode="tail"
          numberOfLines={titleNumberOfLines}
          style={[styles.title, titleStyle]}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text ellipsizeMode="tail" numberOfLines={1} style={styles.subtitle}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {trailing ? <View style={styles.trailing}>{trailing}</View> : null}
    </Pressable>
  );
}
