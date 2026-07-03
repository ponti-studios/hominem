import { FlashList, type ListRenderItem } from '@shopify/flash-list';
import type { TaskListItem as TaskListItemModel } from '@hominem/rpc/types';
import { Stack, useIsFocused, useRouter } from 'expo-router';
import { useCallback } from 'react';
import { RefreshControl, View } from 'react-native';

import { TaskListItem } from '~/components/tasks/TaskListItem';
import { SwipeableTaskRow } from '~/components/tasks/SwipeableTaskRow';
import { makeStyles } from '~/components/theme';
import { EmptyState } from '~/components/ui/EmptyState';
import { getTaskDetailRoute } from '~/services/navigation/routes';
import { useTaskComplete } from '~/services/tasks/use-task-complete';
import { useTaskDelete } from '~/services/tasks/use-task-delete';
import { useTasksQuery } from '~/services/tasks/use-tasks-query';
import t from '~/translations';

export default function TasksScreen() {
  const styles = useStyles();
  const isFocused = useIsFocused();
  const router = useRouter();
  const { data: tasks = [], error, isFetching, refetch } = useTasksQuery({ enabled: isFocused });
  const { mutate: toggleComplete } = useTaskComplete();
  const { mutate: deleteTask } = useTaskDelete();

  const handlePressTask = useCallback(
    (task: TaskListItemModel) => {
      if ((task.childCount ?? 0) > 0) {
        router.push(getTaskDetailRoute(task.id));
      }
    },
    [router],
  );

  const renderItem = useCallback<ListRenderItem<TaskListItemModel>>(
    ({ item }) => (
      <SwipeableTaskRow isList={(item.childCount ?? 0) > 0} onDelete={() => deleteTask(item.id)}>
        <TaskListItem
          task={item}
          onPress={(item.childCount ?? 0) > 0 ? () => handlePressTask(item) : undefined}
          onToggleComplete={() =>
            toggleComplete({ taskId: item.id, completed: item.status !== 'completed' })
          }
        />
      </SwipeableTaskRow>
    ),
    [deleteTask, handlePressTask, toggleComplete],
  );

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: t.tasks.screenTitle }} />
      <FlashList
        contentContainerStyle={styles.listContent}
        data={tasks}
        keyExtractor={(task) => task.id}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            {error ? (
              <EmptyState
                action={{ label: t.tasks.loadErrorRetry, onPress: () => void refetch() }}
                description={t.tasks.loadErrorDescription}
                sfSymbol="arrow.clockwise.circle"
                title={t.tasks.loadErrorTitle}
              />
            ) : (
              <EmptyState
                description={t.tasks.emptyDescription}
                sfSymbol="checklist"
                title={t.tasks.emptyTitle}
              />
            )}
          </View>
        }
        refreshControl={<RefreshControl refreshing={isFetching} onRefresh={() => void refetch()} />}
        renderItem={renderItem}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const useStyles = makeStyles((theme) => ({
  container: {
    backgroundColor: theme.colors['bg-base'],
    flex: 1,
  },
  emptyWrap: {
    paddingTop: 48,
  },
  listContent: {
    paddingBottom: 24,
  },
}));
