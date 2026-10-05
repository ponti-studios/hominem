import { memo } from 'react';
import { Pressable, Text, View } from 'react-native';

import { useAppTheme, useStyles } from '~/components/theme';
import { Checkbox } from '~/components/ui';
import AppIcon from '~/components/ui/icon';

import type { TimeItem } from './time-types';
import { eventTone, itemTimeLabel } from './time-utils';

interface TimeCardProps {
  ended: boolean;
  item: TimeItem;
  onOpen: (item: TimeItem) => void;
  onToggleTask: (item: TimeItem) => void;
}

function useCardStyles() {
  return useStyles((theme) => ({
    event: {
      borderCurve: 'continuous',
      borderRadius: theme.borderRadii.xl,
      gap: 4,
      paddingHorizontal: 16,
      paddingVertical: 14,
    },
    eventTime: { alignItems: 'center', flexDirection: 'row', gap: 6 },
    eventTimeText: { ...theme.textVariants.footnote, fontWeight: '700', opacity: 0.75 },
    eventTitle: { ...theme.textVariants.cardTitle },
    eventMeta: { ...theme.textVariants.subhead, opacity: 0.75 },
    task: {
      alignItems: 'center',
      backgroundColor: theme.colors.card,
      borderCurve: 'continuous',
      borderRadius: theme.borderRadii.xl,
      flexDirection: 'row',
      gap: 14,
      minHeight: 64,
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    taskBody: { flex: 1, gap: 1, minWidth: 0 },
    taskTitle: { ...theme.textVariants.headline, color: theme.colors.foreground },
    taskMeta: { ...theme.textVariants.footnote, color: theme.colors.mutedForeground },
  }));
}

// Events are pastel color blocks; tasks are white cards with a checkbox. The
// two are told apart by shape and fill, not just hue.
export const TimeEventCard = memo(function TimeEventCard({ ended, item, onOpen }: TimeCardProps) {
  const colors = useAppTheme().colors;
  const styles = useCardStyles();
  if (item.kind !== 'event') {
    return null;
  }
  const { value } = item;
  const meta = value.location ?? value.calendarTitle;
  const tone = eventTone(value.calendarTitle ?? value.title);
  return (
    <Pressable
      accessibilityLabel={value.title}
      accessibilityRole="button"
      onPress={() => onOpen(item)}
      style={({ pressed }) => [
        styles.event,
        { backgroundColor: colors[tone], opacity: ended ? 0.55 : pressed ? 0.85 : 1 },
      ]}
      testID={`time-item-event-${value.id}`}
    >
      <View style={styles.eventTime}>
        <AppIcon name="clock" size={13} tintColor={colors.eventForeground} />
        <Text style={[styles.eventTimeText, { color: colors.eventForeground }]}>
          {itemTimeLabel(item)}
        </Text>
      </View>
      <Text style={[styles.eventTitle, { color: colors.eventForeground }]}>{value.title}</Text>
      {meta ? (
        <Text numberOfLines={1} style={[styles.eventMeta, { color: colors.eventForeground }]}>
          {meta}
        </Text>
      ) : null}
    </Pressable>
  );
});

export const TimeTaskCard = memo(function TimeTaskCard({
  item,
  onOpen,
  onToggleTask,
}: TimeCardProps) {
  const styles = useCardStyles();
  if (item.kind !== 'task') {
    return null;
  }
  const { value } = item;
  const completed = value.status === 'completed';
  const meta = [itemTimeLabel(item), value.location].filter(Boolean).join(' · ');
  return (
    <Pressable
      accessibilityLabel={value.title}
      accessibilityRole="button"
      onPress={() => onOpen(item)}
      style={({ pressed }) => [styles.task, pressed && { opacity: 0.85 }]}
      testID={`time-item-task-${value.id}`}
    >
      <Checkbox
        accessibilityLabel={completed ? 'Mark task incomplete' : 'Mark task complete'}
        checked={completed}
        onToggle={() => onToggleTask(item)}
        testID={`time-item-task-${value.id}-toggle`}
      />
      <View style={styles.taskBody}>
        <Text
          numberOfLines={2}
          style={[
            styles.taskTitle,
            completed && { opacity: 0.45, textDecorationLine: 'line-through' },
          ]}
        >
          {value.title}
        </Text>
        <Text numberOfLines={1} style={styles.taskMeta}>
          {completed ? `Done · ${meta}` : meta}
        </Text>
      </View>
    </Pressable>
  );
});
