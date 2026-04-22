import { StyleSheet, View } from 'react-native';

import { Text } from '~/components/theme';
import { useThemeColors } from '~/components/theme/theme';
import { radii, spacing } from '~/components/theme/tokens';

type BadgeVariant = 'default' | 'success' | 'warning' | 'destructive' | 'accent';

interface BadgeProps {
  label: string;
  variant?: BadgeVariant | undefined;
}

function Badge({ label, variant = 'default' }: BadgeProps) {
  const themeColors = useThemeColors();

  const bgColor = {
    default: themeColors['bg-elevated'],
    success: `${themeColors.success}22`,
    warning: `${themeColors.warning}22`,
    destructive: themeColors['destructive-muted'],
    accent: `${themeColors.accent}22`,
  }[variant];

  const textColor = {
    default: themeColors['text-secondary'],
    success: themeColors.success,
    warning: themeColors.warning,
    destructive: themeColors.destructive,
    accent: themeColors.accent,
  }[variant];

  return (
    <View style={[styles.badge, { backgroundColor: bgColor }]}>
      <Text style={[styles.label, { color: textColor }]} variant="caption2">
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
