import { Stack, useRouter } from 'expo-router';
import { RefreshControl, Text, View } from 'react-native';

import { StreamList } from '~/components/stream/StreamList';
import { useAppTheme, useStyles } from '~/components/theme';
import { IconButton, ListRow } from '~/components/ui';
import AppIcon from '~/components/ui/icon';
import { getTaskDetailRoute, getTaskScheduleRoute } from '~/services/navigation/routes';
import { useTasksQuery } from '~/services/tasks/use-tasks-query';

import { getUnscheduledTasks } from './time-utils';

function TaskRow({
  item,
}: {
  item: {
    id: string;
    title: string;
    durationMinutes?: number | null;
    childCount?: number | null;
  };
}) {
  const router = useRouter();
  const { success: successColor } = useAppTheme().colors;
  const childCount = item.childCount ?? 0;
  const subtitle =
    childCount > 0
      ? `${childCount} sub-task${childCount === 1 ? '' : 's'}`
      : item.durationMinutes
        ? `${item.durationMinutes} min`
        : null;
  return (
    <ListRow
      accessibilityLabel={item.title}
      leading=<AppIcon
        name={childCount > 0 ? 'square.stack' : 'circle'}
        size={20}
        tintColor={successColor}
      />
      onPress={() => router.push(getTaskDetailRoute(item.id))}
      subtitle={subtitle}
      testID={`unscheduled-task-${item.id}`}
      title={item.title}
      trailing={
        <IconButton
          accessibilityLabel={`Schedule ${item.title}`}
          onPress={() => router.push(getTaskScheduleRoute(item.id))}
          testID={`unscheduled-task-${item.id}-schedule`}
        >
          <AppIcon name="calendar.badge.plus" size={20} />
        </IconButton>
      }
    />
  );
}

export function TasksScreen() {
  const { data: tasks = [], isFetching, refetch } = useTasksQuery();
  const unscheduledTasks = getUnscheduledTasks(tasks);
  const styles = useStyles((theme) => ({
    container: { flex: 1, backgroundColor: theme.colors.background },
    emptyStateText: { color: theme.colors.mutedForeground, paddingHorizontal: 16, paddingTop: 24 },
  }));

  return (
    <View style={styles.container} testID="unscheduled-tasks-screen">
      <Stack.Screen options={{ headerShown: true, title: 'Tasks' }} />
      <StreamList
        contentPaddingTop={16}
        data={unscheduledTasks}
        keyExtractor={(task) => task.id}
        ListEmptyComponent={
          !isFetching ? (
            <Text style={styles.emptyStateText}>Every open task has a time or deadline.</Text>
          ) : null
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
