import { Text, View } from 'react-native';

import { useStyles } from '~/components/theme';
import { formatClockTime } from '~/services/date/format-date';

export function TimeNowMarker({ now }: { now: Date }) {
  const styles = useStyles((theme) => ({
    row: { alignItems: 'center', flexDirection: 'row', gap: 8, paddingVertical: 2 },
    pill: {
      backgroundColor: theme.colors.coral,
      borderRadius: theme.borderRadii.pill,
      paddingHorizontal: 10,
      paddingVertical: 3,
    },
    label: {
      ...theme.textVariants.caption1,
      color: theme.colors.primaryForeground,
      fontWeight: '700',
    },
    line: {
      backgroundColor: theme.colors.coral,
      borderRadius: 1,
      flex: 1,
      height: 2,
      opacity: 0.5,
    },
  }));
  return (
    <View accessibilityLabel="Current time" style={styles.row} testID="time-now-marker">
      <View style={styles.pill}>
        <Text style={styles.label}>Now {formatClockTime(now)}</Text>
      </View>
      <View style={styles.line} />
    </View>
  );
}
