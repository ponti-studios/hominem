import { StyleSheet, View } from 'react-native';

import { colors, radii, spacing } from '~/components/theme/tokens';

import { Text } from '~/components/theme';

type BadgeVariant = 'default' | 'success' | 'warning' | 'destructive' | 'accent';

interface BadgeProps {
  label: string;
  variant?: BadgeVariant | undefined;
}

const backgroundColors: Record<BadgeVariant, string> = {
  default: colors['bg-elevated'],
  success: `${colors.success}22`,
  warning: `${colors.warning}22`,
  destructive: colors['destructive-muted'],
  accent: `${colors.accent}22`,
};

const textColors: Record<BadgeVariant, string> = {
  default: colors['text-secondary'],
  success: colors.success,
  warning: colors.warning,
  destructive: colors.destructive,
  accent: colors.accent,
};

function Badge({ label, variant = 'default' }: BadgeProps) {
  return (
    <View style={[styles.badge, { backgroundColor: backgroundColors[variant] }]}>
      <Text style={[styles.label, { color: textColors[variant] }]} variant="caption2">
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderCurve: 'continuous',
    borderRadius: radii.sm,
    flexDirection: 'row',
    paddingHorizontal: spacing[2],
    paddingVertical: 3,
  },
  label: {
    fontWeight: '500',
    letterSpacing: 0.3,
  },
});

export { Badge };
export type { BadgeProps, BadgeVariant };
