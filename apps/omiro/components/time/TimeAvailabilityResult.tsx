import { Pressable, Text, View } from 'react-native';

import { useStyles } from '~/components/theme';
import { formatClockTime } from '~/services/date/format-date';

import { formatDateTime } from './time-result-formatters';
import type { TimeOpening } from './time-types';
import { CancelRow } from './TimeResultActions';

interface TimeAvailabilityResultProps {
  onCancel?: () => void;
  onChooseOpening?: (opening: TimeOpening) => void;
  openings: TimeOpening[];
}

function minutesBetween(start: string, end: string) {
  return Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60_000);
}

export function TimeAvailabilityResult({
  openings,
  onCancel,
  onChooseOpening,
}: TimeAvailabilityResultProps) {
  const styles = useStyles((theme) => ({
    heading: { ...theme.textVariants.title1, color: theme.colors.foreground },
    option: {
      alignItems: 'center',
      backgroundColor: theme.colors.background,
      borderCurve: 'continuous',
      borderRadius: theme.borderRadii.xl,
      flexDirection: 'row',
      gap: 12,
      minHeight: 64,
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    optionBody: { flex: 1 },
    time: { ...theme.textVariants.headline, color: theme.colors.foreground },
    end: { ...theme.textVariants.subhead, color: theme.colors.mutedForeground },
    pick: {
      backgroundColor: theme.colors.primary,
      borderRadius: theme.borderRadii.pill,
      paddingHorizontal: 16,
      paddingVertical: 8,
    },
    pickLabel: {
      ...theme.textVariants.subhead,
      color: theme.colors.primaryForeground,
      fontWeight: '700',
    },
  }));
  const shown = openings.slice(0, 3);

  return (
    <>
      <Text style={styles.heading}>
        {shown.length === 1 ? 'One good time' : `${shown.length} good times`}
      </Text>
      {shown.map((opening) => (
        <Pressable
          accessibilityLabel={`Use ${new Date(opening.start).toLocaleString()}`}
          accessibilityRole="button"
          key={opening.start}
          onPress={() => onChooseOpening?.(opening)}
          style={({ pressed }) => [styles.option, pressed && { opacity: 0.8 }]}
          testID="time-availability-opening"
        >
          <View style={styles.optionBody}>
            <Text style={styles.time}>{formatDateTime(opening.start)}</Text>
            <Text style={styles.end}>
              {minutesBetween(opening.start, opening.end)} min · until{' '}
              {formatClockTime(opening.end)}
            </Text>
          </View>
          <View style={styles.pick}>
            <Text style={styles.pickLabel}>Pick</Text>
          </View>
        </Pressable>
      ))}
      <CancelRow onCancel={onCancel} testID="time-availability-cancel" />
    </>
  );
}
