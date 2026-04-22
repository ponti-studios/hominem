import { SymbolView, type SFSymbol } from 'expo-symbols';
import { memo, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text, makeStyles } from '~/components/theme';
import { useThemeColors } from '~/components/theme/theme';
import { spacing } from '../theme/tokens';

const ROW_MIN_HEIGHT = 50;

export interface ListRowProps {
  accessibilityLabel?: string | undefined;
  destructive?: boolean | undefined;
  disabled?: boolean | undefined;
  leading?: ReactNode;
  onPress?: (() => void) | undefined;
  subtitle?: string | undefined;
  title: string;
  trailing?: ReactNode;
}

const ListRow = memo(function ListRow({
  accessibilityLabel,
  destructive = false,
  disabled = false,
  leading,
  onPress,
  subtitle,
  title,
  trailing,
}: ListRowProps) {
  const styles = useListRowStyles();
  const themeColors = useThemeColors();
  const titleColor = destructive ? themeColors.destructive : themeColors.foreground;

  const content = (
    <View style={[styles.row, disabled ? styles.disabled : null]}>
      {leading ? <View style={styles.leading}>{leading}</View> : null}
      <View style={styles.content}>
        <Text style={[styles.title, { color: titleColor }]} variant="callout">
          {title}
        </Text>
        {subtitle ? (
          <Text color="text-tertiary" style={styles.subtitle} variant="caption1">
            {subtitle}
          </Text>
        ) : null}
      </View>
      {trailing !== undefined ? (
        <View style={styles.trailing}>{trailing}</View>
      ) : onPress && !disabled ? (
        <SymbolView
          name={'chevron.right' as SFSymbol}
          size={14}
          tintColor={themeColors['text-tertiary']}
          style={styles.chevron}
        />
      ) : null}
    </View>
  );

  if (onPress && !disabled) {
    return (
      <Pressable
        accessibilityLabel={accessibilityLabel ?? title}
        accessibilityRole="button"
        accessibilityState={{ disabled }}
        onPress={onPress}
        style={({ pressed }) => [styles.pressable, pressed ? styles.pressed : null]}
      >
        {content}
      </Pressable>
    );
  }

  return <View style={styles.pressable}>{content}</View>;
});

const useListRowStyles = makeStyles((theme) => ({
  pressable: {
    minHeight: ROW_MIN_HEIGHT,
  },
  pressed: {
    backgroundColor: theme.colors['bg-elevated'],
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing[3],
    minHeight: ROW_MIN_HEIGHT,
    paddingHorizontal: spacing[4],
  },
  disabled: {
    opacity: 0.4,
  },
  leading: {
    flexShrink: 0,
  },
  content: {
    flex: 1,
    gap: 2,
    paddingVertical: spacing[3],
  },
  title: {
    letterSpacing: -0.1,
  },
  subtitle: {},
  trailing: {
    alignItems: 'flex-end',
    flexShrink: 0,
  },
  chevron: {
    opacity: 0.4,
  },
}));

export { ListRow };
