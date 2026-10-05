import { memo, useCallback } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { useAppTheme, useStyles } from '~/components/theme';

import { localDayKey } from './time-utils';

const WEEKDAY = { weekday: 'narrow' } as const;

interface DayPillProps {
  date: Date;
  offset: number;
  hasItems: boolean;
  onSelect: (key: string) => void;
  selected: boolean;
}

const DayPill = memo(function DayPill({
  date,
  hasItems,
  offset,
  onSelect,
  selected,
}: DayPillProps) {
  const { card, ink, inkForeground, foreground, lime, primary } = useAppTheme().colors;
  const styles = useStyles((theme) => ({
    pill: {
      alignItems: 'center',
      borderCurve: 'continuous',
      borderRadius: 20,
      gap: 2,
      height: 68,
      justifyContent: 'center',
      width: 50,
    },
    weekday: { ...theme.textVariants.caption1, fontWeight: '600', opacity: 0.7 },
    number: { ...theme.textVariants.title2, fontWeight: '700' },
    dot: { borderRadius: 3, height: 5, width: 5 },
  }));
  const key = localDayKey(date);
  const color = selected ? inkForeground : foreground;
  return (
    <Pressable
      accessibilityLabel={date.toLocaleDateString(undefined, {
        day: 'numeric',
        month: 'long',
        weekday: 'long',
      })}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={() => onSelect(key)}
      style={[styles.pill, { backgroundColor: selected ? ink : card }]}
      testID={`time-day-${offset}`}
    >
      <Text style={[styles.weekday, { color }]}>{date.toLocaleDateString(undefined, WEEKDAY)}</Text>
      <Text style={[styles.number, { color }]}>{date.getDate()}</Text>
      <View
        style={[
          styles.dot,
          { backgroundColor: hasItems ? (selected ? lime : primary) : 'transparent' },
        ]}
      />
    </Pressable>
  );
});

interface TimeDayStripProps {
  daysWithItems: ReadonlySet<string>;
  days: Date[];
  onSelect: (key: string) => void;
  selectedKey: string;
}

// A horizontal run of day pills. Pills are memoized and receive primitives
// only, so selecting a day re-renders two pills, not the strip.
export function TimeDayStrip({ days, daysWithItems, onSelect, selectedKey }: TimeDayStripProps) {
  const styles = useStyles(() => ({
    content: { gap: 6, paddingHorizontal: 16 },
    // A horizontal ScrollView grows to fill a column; keep it to its pills.
    strip: { flexGrow: 0 },
  }));
  const handleSelect = useCallback((key: string) => onSelect(key), [onSelect]);

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.strip}
      testID="time-day-strip"
    >
      {days.map((date, offset) => {
        const key = localDayKey(date);
        return (
          <DayPill
            date={date}
            hasItems={daysWithItems.has(key)}
            key={key}
            offset={offset}
            onSelect={handleSelect}
            selected={key === selectedKey}
          />
        );
      })}
    </ScrollView>
  );
}
