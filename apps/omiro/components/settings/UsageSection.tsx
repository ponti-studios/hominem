import type { MonthlyUsageStatus } from '@hominem/rpc/types';
import { Text, View } from 'react-native';

import { SectionLabel } from '~/components/settings/SettingsRow';
import { useAppTheme, useStyles } from '~/components/theme';

const usdFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
});
function formatUsagePeriod(periodStart: string): string {
  const month = periodStart.slice(5, 7);
  const year = periodStart.slice(2, 4);
  return `${month} '${year}`;
}

function formatUsd(amount: number): string {
  return usdFormatter.format(amount);
}

export function UsageSection({ monthlyUsage }: { monthlyUsage: MonthlyUsageStatus }) {
  const {
    foreground: textPrimaryColor,
    border: borderDefaultColor,
    destructive: destructiveColor,
  } = useAppTheme().colors;
  const styles = useStyles((theme) => ({
    usageSection: { gap: 8 },
    usageSummary: { flexDirection: 'row', alignItems: 'baseline', gap: 8, paddingHorizontal: 16 },
    usageAmount: {
      fontSize: 28,
      fontWeight: '700',
      letterSpacing: -0.4,
      color: theme.colors.foreground,
    },
    usageLimit: { color: theme.colors.mutedForeground },
    usageBar: { borderRadius: 4, height: 4, marginHorizontal: 4, overflow: 'hidden' },
    usageBarFill: { borderRadius: 4, height: 4 },
    usageResetMessage: { color: theme.colors.tertiary, paddingHorizontal: 16 },
  }));

  const usagePercent = Math.min(100, (monthlyUsage.totalCostUsd / monthlyUsage.limitUsd) * 100);

  return (
    <View testID="settings-usage-section" style={styles.usageSection}>
      <SectionLabel>{`AI usage · ${formatUsagePeriod(monthlyUsage.periodStart)}`}</SectionLabel>
      <View style={styles.usageSummary}>
        <Text style={[styles.usageAmount, { fontVariant: ['tabular-nums'] }]}>
          {formatUsd(monthlyUsage.totalCostUsd)}
        </Text>
        <Text style={[styles.usageLimit, { fontVariant: ['tabular-nums'] }]}>
          of {formatUsd(monthlyUsage.limitUsd)} · {usagePercent.toFixed(0)}%
        </Text>
      </View>
      <View style={[styles.usageBar, { backgroundColor: borderDefaultColor }]}>
        <View
          style={[
            styles.usageBarFill,
            {
              width: `${usagePercent}%`,
              backgroundColor: monthlyUsage.isOverLimit ? destructiveColor : textPrimaryColor,
            },
          ]}
        />
      </View>
      <Text style={styles.usageResetMessage}>
        {monthlyUsage.isOverLimit
          ? "You've reached this month's free AI usage limit. It resets at the start of next month."
          : 'Resets at the start of next month.'}
      </Text>
    </View>
  );
}
