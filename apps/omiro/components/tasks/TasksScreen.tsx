import { useState } from 'react';
import { View } from 'react-native';

import { useStyles } from '~/components/theme';
import type { TaskListItem } from '~/services/tasks/task-types';
import { useTaskComplete } from '~/services/tasks/use-task-complete';
import { useTasksQuery } from '~/services/tasks/use-tasks-query';

import { getOpenTasks } from './task-time';
import { TaskDetailSheet } from './TaskDetailSheet';
import { TaskList } from './TaskList';

// The Tasks page: every open task as a card, with an in-app detail sheet.
export function TasksScreen() {
  const { data: tasks = [], isRefetching, refetch } = useTasksQuery();
  const { mutate: toggleTask } = useTaskComplete();
  const [detailTaskId, setDetailTaskId] = useState<string | null>(null);
  const openTasks = getOpenTasks(tasks);
  const detailTask = tasks.find((task) => task.id === detailTaskId) ?? null;
  const styles = useStyles((theme) => ({
    container: {
      backgroundColor: theme.colors.background,
      flex: 1,
      paddingHorizontal: 16,
    },
    title: {
      ...theme.textVariants.display,
      color: theme.colors.foreground,
      paddingBottom: 14,
      paddingHorizontal: 4,
    },
  }));

  return (
    <View style={styles.container} testID="unscheduled-tasks-screen">
      <TaskList
        adjustForHeader
        contentPaddingBottom={48}
        contentPaddingTop={16}
        emptyText="You have no open tasks."
        onGround
        onOpen={(task: TaskListItem) => setDetailTaskId(task.id)}
        onRefresh={refetch}
        onToggle={(task: TaskListItem) =>
          toggleTask({ completed: task.status !== 'completed', taskId: task.id })
        }
        refreshing={isRefetching}
        tasks={openTasks}
      />
      <TaskDetailSheet
        onClose={() => setDetailTaskId(null)}
        onError={() => undefined}
        task={detailTask}
      />
    </View>
  );
}
