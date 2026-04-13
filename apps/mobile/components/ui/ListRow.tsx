import { spacing } from '@hominem/ui/tokens';
import { Image } from 'expo-image';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text, theme } from '~/components/theme';

const ROW_MIN_HEIGHT = 50;

export interface ListRowProps {
  /** Optional leading element (icon wrap, avatar, etc.) */
  leading?: React.ReactNode;
  title: string;
  subtitle?: string;
  /** Optional trailing element (Switch, Text value, custom). Omit to show chevron when onPress is provided. */
  trailing?: React.ReactNode;
  onPress?: () => void;
  destructive?: boolean;
  disabled?: boolean;
  accessibilityLabel?: string;
}

export const ListRow = React.memo(function ListRow({
  leading,
  title,
  subtitle,
  trailing,
  onPress,
  destructive = false,
  disabled = false,
  accessibilityLabel,
}: ListRowProps) {
  const titleColor = destructive ? theme.colors.destructive : theme.colors.foreground;

  const inner = (
    <View style={[styles.row, disabled && styles.rowDisabled]}>
      {leading ? <View style={styles.leading}>{leading}</View> : null}

      <View style={styles.content}>
        <Text style={[styles.title, { color: titleColor }]}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>

      {trailing !== undefined ? (
        <View style={styles.trailing}>{trailing}</View>
      ) : onPress && !disabled ? (
        <Image
          source="sf:chevron.right"
          style={styles.chevron}
          tintColor={theme.colors['text-tertiary']}
          contentFit="contain"
        />
      ) : null}
    </View>
  );

  if (onPress && !disabled) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.pressable, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? title}
        accessibilityState={{ disabled }}
      >
        {inner}
      </Pressable>
    );
  }

  return <View style={styles.pressable}>{inner}</View>;
});

const styles = StyleSheet.create({
  pressable: {
    minHeight: ROW_MIN_HEIGHT,
  },
  pressed: {
    backgroundColor: theme.colors['bg-elevated'],
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingHorizontal: spacing[4],
    minHeight: ROW_MIN_HEIGHT,
  },
  rowDisabled: {
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
    fontSize: 16,
    fontWeight: '400',
    letterSpacing: -0.1,
    color: theme.colors.foreground,
  },
  subtitle: {
    fontSize: 12,
    color: theme.colors['text-tertiary'],
  },
  trailing: {
    flexShrink: 0,
    alignItems: 'flex-end',
  },
  chevron: {
    width: 14,
    height: 14,
    opacity: 0.4,
  },
});
