import { StackScreen } from 'expo-router/build/layouts/stack-utils';
import { Alert, RefreshControl, Text, View } from 'react-native';

import { StreamList } from '~/components/stream/StreamList';
import { useAppTheme, useStyles } from '~/components/theme';
import { ListRow } from '~/components/ui';
import AppIcon from '~/components/ui/icon';
import { openReminderInSystemApp } from '~/services/tasks/open-reminder';
import { taskDurationMinutes, type TaskListItem } from '~/services/tasks/task-types';
import { useTasksQuery } from '~/services/tasks/use-tasks-query';

import { getOpenTasks } from './time-utils';

function TaskRow({ item }: { item: TaskListItem }) {
  const { success: successColor } = useAppTheme().colors;
  const durationMinutes = taskDurationMinutes(item);
  const subtitle = durationMinutes ? `${durationMinutes} min` : null;

  return (
    <ListRow
      accessibilityLabel={item.title}
      leading={<AppIcon name="circle" size={20} tintColor={successColor} />}
      onPress={() => {
        void openReminderInSystemApp(item.id).catch(() => {
          Alert.alert('Unable to open Reminders', 'Open the Reminders app to view this task.');
        });
      }}
      subtitle={subtitle}
      testID={`unscheduled-task-${item.id}`}
      title={item.title}
    />
  );
}

export function TasksScreen() {
  const { data: tasks = [], isFetching, refetch } = useTasksQuery();
  const openTasks = getOpenTasks(tasks);
  const styles = useStyles((theme) => ({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
      marginHorizontal: 8,
      marginBottom: 50,
      marginTop: 16,
      //   @NOTE Border
      //   borderRadius: theme.borderRadii.xl,
      //   borderColor: theme.colors.border,
      //   borderWidth: 1,
    },
    emptyStateText: { color: theme.colors.mutedForeground, paddingHorizontal: 16, paddingTop: 24 },
  }));

  return (
    <View style={styles.container} testID="unscheduled-tasks-screen">
      <StackScreen options={{ headerShown: false }} />
      <StreamList
        contentPaddingTop={8}
        data={openTasks}
        keyExtractor={(task) => task.id}
        ListEmptyComponent={
          !isFetching ? <Text style={styles.emptyStateText}>You have no open tasks.</Text> : null
        }
        refreshControl={
          <RefreshControl
            refreshing={isFetching}
            onRefresh={() => {
              void refetch();
            }}
          />
        }
        /**
         * @NOTE Use a function instead of calling the component directly
         * (`renderItem={TaskRow}`).
         *
         * This ensures that a new instance of the component is created for each item, preventing potential issues with stale props or state.
         * React's reconciliation engine compares the element returned during the current render with the element from the
         * previous render. When their component type and key match, React preserves the existing component instance and its
         * local state, then supplies it with the next props. Virtualized lists also recycle rendered cells as items scroll in
         * and out of view, so a cell previously associated with one task can be reused for another task.
         *
         * Rendering `<TaskRow item={item} />` explicitly gives React a TaskRow element for the current list item. The list's
         * item key identifies that element, allowing React to reconcile it with the correct task and mount or unmount it when
         * necessary. This is preferable to passing TaskRow as the list callback because renderItem receives list metadata
         * (such as index and separators), whereas TaskRow expects only an `item` prop.
         */
        renderItem={({ item }) => <TaskRow item={item} />}
        testID="unscheduled-task-list"
      />
    </View>
  );
}
