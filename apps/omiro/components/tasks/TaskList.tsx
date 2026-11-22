import { memo } from 'react';
import { Pressable, Text, View } from 'react-native';

import { useStyles } from '~/components/theme';
import { Checkbox } from '~/components/ui';
import { taskDurationMinutes, type TaskListItem } from '~/services/tasks/task-types';

import { taskTimeLabel } from './task-time';

interface TaskRowProps {
  item: TaskListItem;
  onGround: boolean;
  onOpen: (task: TaskListItem) => void;
  onToggle: (task: TaskListItem) => void;
}

export const TaskRow = memo(function TaskRow({ item, onGround, onOpen, onToggle }: TaskRowProps) {
  const styles = useStyles((theme) => ({
    row: {
      alignItems: 'center',
      backgroundColor: onGround ? theme.colors.card : theme.colors.background,
      borderCurve: 'continuous',
      borderRadius: theme.borderRadii.xl,
      flexDirection: 'row',
      gap: 14,
      minHeight: 64,
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    body: { flex: 1, gap: 1, minWidth: 0 },
    title: { ...theme.textVariants.headline, color: theme.colors.foreground },
    meta: { ...theme.textVariants.footnote, color: theme.colors.mutedForeground },
  }));
  const minutes = taskDurationMinutes(item);
  const when = taskTimeLabel(item);
  const meta = [when, minutes ? `${minutes} min` : null].filter(Boolean).join(' · ');
  const completed = item.status === 'completed';
  return (
    <Pressable
      accessibilityLabel={item.title}
      accessibilityRole="button"
      onPress={() => onOpen(item)}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.85 }]}
      testID={`unscheduled-task-${item.id}`}
    >
      <Checkbox
        accessibilityLabel={completed ? 'Mark task incomplete' : 'Mark task complete'}
        checked={completed}
        onToggle={() => onToggle(item)}
      />
      <View style={styles.body}>
        <Text
          numberOfLines={2}
          style={[styles.title, completed && { opacity: 0.45, textDecorationLine: 'line-through' }]}
        >
          {item.title}
        </Text>
        {meta ? <Text style={styles.meta}>{meta}</Text> : null}
      </View>
    </Pressable>
  );
});
