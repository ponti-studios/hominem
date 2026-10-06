import { Pressable, Text, View } from 'react-native';

import { useStyles } from '~/components/theme';
import type { TaskListItem } from '~/services/tasks/task-types';

import { fromLabel } from './task-time';

interface CarriedOverCardProps {
  task: TaskListItem;
  onOpen: (task: TaskListItem) => void;
  onDone: (task: TaskListItem) => void;
  onMove: (task: TaskListItem) => void;
  onDrop: (task: TaskListItem) => void;
}

// A task left over from an earlier day. It asks for a decision on the spot:
// finish it, give it a new day, or let it go.
export function CarriedOverCard({ task, onOpen, onDone, onMove, onDrop }: CarriedOverCardProps) {
  const styles = useStyles((theme) => ({
    card: {
      backgroundColor: theme.colors.card,
      borderCurve: 'continuous',
      borderRadius: theme.borderRadii.xl,
      gap: 10,
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    head: { alignItems: 'center', flexDirection: 'row', gap: 14 },
    mark: {
      borderColor: theme.colors.mutedForeground,
      borderCurve: 'continuous',
      borderRadius: 11,
      borderWidth: 2.5,
      height: 30,
      width: 30,
    },
    body: { flex: 1, minWidth: 0 },
    title: { ...theme.textVariants.headline, color: theme.colors.foreground },
    meta: { ...theme.textVariants.footnote, color: theme.colors.mutedForeground },
    actions: { flexDirection: 'row', gap: 8 },
    button: {
      alignItems: 'center',
      borderRadius: theme.borderRadii.pill,
      flex: 1,
      height: 36,
      justifyContent: 'center',
    },
    done: { backgroundColor: theme.colors.lime },
    move: { backgroundColor: theme.colors.eventViolet },
    drop: { backgroundColor: theme.colors.card },
    label: { ...theme.textVariants.chip, color: theme.colors.foreground, fontWeight: '700' },
    dropLabel: { ...theme.textVariants.chip, color: theme.colors.coral, fontWeight: '700' },
  }));
  return (
    <View style={styles.card} testID={`carried-${task.id}`}>
      <Pressable
        accessibilityLabel={task.title}
        accessibilityRole="button"
        onPress={() => onOpen(task)}
        style={styles.head}
      >
        <View style={styles.mark} />
        <View style={styles.body}>
          <Text numberOfLines={2} style={styles.title}>
            {task.title}
          </Text>
          <Text style={styles.meta}>{fromLabel(task)}</Text>
        </View>
      </Pressable>
      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          onPress={() => onDone(task)}
          style={[styles.button, styles.done]}
          testID={`carried-done-${task.id}`}
        >
          <Text style={styles.label}>Done</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => onMove(task)}
          style={[styles.button, styles.move]}
          testID={`carried-move-${task.id}`}
        >
          <Text style={styles.label}>Move</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => onDrop(task)}
          style={[styles.button, styles.drop]}
          testID={`carried-drop-${task.id}`}
        >
          <Text style={styles.dropLabel}>Drop</Text>
        </Pressable>
      </View>
    </View>
  );
}
