import { Text, View } from 'react-native';

import { useStyles } from '~/components/theme';
import { BottomSheet } from '~/components/ui';
import type { TaskListItem } from '~/services/tasks/task-types';

import { TimeTaskList } from './TimeTaskList';

interface TimeInboxSheetProps {
  onClose: () => void;
  onOpenTask: (task: TaskListItem) => void;
  onToggleTask: (task: TaskListItem) => void;
  tasks: TaskListItem[];
  visible: boolean;
}

// Unscheduled tasks, one tap from the Time header. Tapping a task opens its
// detail, where it can be given a time.
export function TimeInboxSheet({
  onClose,
  onOpenTask,
  onToggleTask,
  tasks,
  visible,
}: TimeInboxSheetProps) {
  const styles = useStyles((theme) => ({
    header: {
      alignItems: 'baseline',
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingBottom: 12,
    },
    title: { ...theme.textVariants.title1, color: theme.colors.foreground },
    count: {
      ...theme.textVariants.subhead,
      color: theme.colors.mutedForeground,
      fontWeight: '600',
    },
    list: { flexShrink: 1, minHeight: 120 },
    hint: {
      ...theme.textVariants.footnote,
      color: theme.colors.mutedForeground,
      fontWeight: '600',
      paddingTop: 12,
      textAlign: 'center',
    },
  }));
  return (
    <BottomSheet maxHeight="80%" onClose={onClose} testID="time-inbox-sheet" visible={visible}>
      <View style={styles.header}>
        <Text style={styles.title}>Inbox</Text>
        <Text style={styles.count}>
          {tasks.length === 0 ? 'All placed' : `${tasks.length} to place`}
        </Text>
      </View>
      <View style={styles.list}>
        <TimeTaskList
          emptyText="Nothing waiting. Everything has a time."
          onOpen={onOpenTask}
          onToggle={onToggleTask}
          tasks={tasks}
        />
      </View>
      {tasks.length > 0 ? <Text style={styles.hint}>Tap a task to find it a time</Text> : null}
    </BottomSheet>
  );
}
