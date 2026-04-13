import { radiiNative, spacing } from '@hominem/ui/tokens';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { Text, theme } from '~/components/theme';

type BadgeVariant = 'default' | 'success' | 'warning' | 'destructive' | 'accent';

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
}

const variantBg: Record<BadgeVariant, string> = {
  default: theme.colors['bg-elevated'],
  success: `${theme.colors.success}22`,
  warning: `${theme.colors.warning}22`,
  destructive: `${theme.colors['destructive-muted']}`,
  accent: `${theme.colors.accent}22`,
};

const variantText: Record<BadgeVariant, string> = {
  default: theme.colors['text-secondary'],
  success: theme.colors.success,
  warning: theme.colors.warning,
  destructive: theme.colors.destructive,
  accent: theme.colors.accent,
};

export function Badge({ label, variant = 'default' }: BadgeProps) {
  return (
    <View style={[styles.badge, { backgroundColor: variantBg[variant] }]}>
      <Text style={[styles.label, { color: variantText[variant] }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    alignItems: 'center',
    paddingHorizontal: spacing[2],
    paddingVertical: 3,
    borderRadius: radiiNative.full,
    borderCurve: 'continuous',
  },
  label: {
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 0.3,
  },
});
