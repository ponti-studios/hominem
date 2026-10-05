import { useState } from 'react';
import { Alert, Text, View } from 'react-native';

import { useStyles } from '~/components/theme';
import { BottomSheet, Checkbox, Chip } from '~/components/ui';
import { Button } from '~/components/ui/button';
import { openReminderInSystemApp } from '~/services/tasks/open-reminder';
import { taskDurationMinutes, type TaskListItem } from '~/services/tasks/task-types';
import { useTaskComplete } from '~/services/tasks/use-task-complete';
import { useTaskDelete } from '~/services/tasks/use-task-delete';

import { taskTimeLabel } from './task-time';

interface TaskDetailSheetProps {
  onClose: () => void;
  onError: (message: string) => void;
  task: TaskListItem | null;
}

// In-app task detail: complete, open it in Reminders, or delete it. Reads the live task from the list so a toggle reflects at once.
export function TaskDetailSheet({ onClose, onError, task }: TaskDetailSheetProps) {
  const [lastTask, setLastTask] = useState<TaskListItem | null>(null);
  const complete = useTaskComplete();
  const remove = useTaskDelete();
  const styles = useStyles((theme) => ({
    titleRow: { alignItems: 'center', flexDirection: 'row', gap: 14 },
    title: { ...theme.textVariants.title1, color: theme.colors.foreground, flex: 1 },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    notes: {
      ...theme.textVariants.body,
      backgroundColor: theme.colors.background,
      borderCurve: 'continuous',
      borderRadius: theme.borderRadii.xl,
      color: theme.colors.foreground,
      padding: 16,
    },
    actions: { flexDirection: 'row', gap: 10 },
    action: { flex: 1 },
    stack: { gap: 14 },
  }));
  // Hold the last task so the sheet keeps its content while animating out.
  if (task && task !== lastTask) {
    setLastTask(task);
  }
  const shown = task ?? lastTask;

  const toggle = () => {
    if (shown) {
      complete.mutate({ completed: shown.status !== 'completed', taskId: shown.id });
    }
  };

  const confirmDelete = () => {
    if (!shown) {
      return;
    }
    Alert.alert('Delete this task?', shown.title, [
      { style: 'cancel', text: 'Cancel' },
      {
        style: 'destructive',
        text: 'Delete',
        onPress: () => {
          remove.mutate(shown.id, { onError: () => onError('Unable to delete this task.') });
          onClose();
        },
      },
    ]);
  };

  const openInReminders = () => {
    if (!shown) {
      return;
    }
    void openReminderInSystemApp(shown.id).catch(() =>
      onError('Unable to open the Reminders app.'),
    );
  };

  const timeLabel = shown ? taskTimeLabel(shown) : null;
  const minutes = shown ? taskDurationMinutes(shown) : null;
  const completed = shown?.status === 'completed';

  return (
    <BottomSheet onClose={onClose} testID="task-detail" visible={task !== null}>
      {shown ? (
        <View style={styles.stack}>
          <View style={styles.titleRow}>
            <Checkbox
              accessibilityLabel={completed ? 'Mark task incomplete' : 'Mark task complete'}
              checked={completed}
              onToggle={toggle}
            />
            <Text style={styles.title}>{shown.title}</Text>
          </View>
          <View style={styles.chips}>
            <Chip icon="calendar" label={timeLabel ?? 'No time yet'} />
            {minutes ? <Chip icon="clock" label={`${minutes} min`} /> : null}
            {shown.location ? <Chip icon="mappin.and.ellipse" label={shown.location} /> : null}
            {shown.listTitle ? <Chip icon="list.bullet" label={shown.listTitle} /> : null}
          </View>
          {shown.notes ? <Text style={styles.notes}>{shown.notes}</Text> : null}
          <View style={styles.actions}>
            <Button
              label={completed ? 'Undo' : 'Done'}
              onPress={toggle}
              size="lg"
              style={styles.action}
              testID="task-toggle"
              variant={completed ? 'secondary' : 'primary'}
            />
          </View>
          <Button label="Open in Reminders" onPress={openInReminders} size="md" variant="ghost" />
          <Button
            label="Delete task"
            onPress={confirmDelete}
            size="md"
            variant="ghost"
            testID="task-delete"
          />
        </View>
      ) : null}
    </BottomSheet>
  );
}
