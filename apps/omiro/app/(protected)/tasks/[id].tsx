import type { Task } from '@hominem/rpc/types';
import { FlashList, type ListRenderItem } from '@shopify/flash-list';
import { Stack, useIsFocused, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback } from 'react';
import { Alert, RefreshControl, View } from 'react-native';

import { SwipeableTaskRow } from '~/components/tasks/SwipeableTaskRow';
import { TaskListItem } from '~/components/tasks/TaskListItem';
import { makeStyles } from '~/components/theme';
import { EmptyState } from '~/components/ui/EmptyState';
import { useTaskComplete } from '~/services/tasks/use-task-complete';
import { useTaskDelete } from '~/services/tasks/use-task-delete';
import { useTaskQuery } from '~/services/tasks/use-task-query';
import t from '~/translations';

export default function TaskDetailScreen() {
  const styles = useStyles();
  const router = useRouter();
  const isFocused = useIsFocused();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, error, isFetching, refetch } = useTaskQuery({ taskId: id, enabled: isFocused });
  const { mutate: toggleComplete } = useTaskComplete({ parentId: id });
  const { mutate: deleteChild } = useTaskDelete({ parentId: id });
  const { mutate: deleteList } = useTaskDelete();

  const handleDeleteList = useCallback(() => {
    Alert.alert(t.tasks.deleteList.title, t.tasks.deleteList.message, [
      { text: t.tasks.deleteList.cancel, style: 'cancel' },
      {
        text: t.tasks.deleteList.confirm,
        style: 'destructive',
        onPress: () => {
          deleteList(id, { onSuccess: () => router.back() });
        },
      },
    ]);
  }, [deleteList, id, router]);

  const renderItem = useCallback<ListRenderItem<Task>>(
    ({ item }) => (
      <SwipeableTaskRow onDelete={() => deleteChild(item.id)}>
        <TaskListItem
          task={item}
          onToggleComplete={() =>
            toggleComplete({ taskId: item.id, completed: item.status !== 'completed' })
          }
        />
      </SwipeableTaskRow>
    ),
    [deleteChild, toggleComplete],
  );

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: data?.task.title ?? '' }} />
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Menu accessibilityLabel={t.tasks.itemActionsA11y} icon="ellipsis">
          <Stack.Toolbar.MenuAction icon="trash" destructive onPress={handleDeleteList}>
            {t.tasks.deleteList.menu}
          </Stack.Toolbar.MenuAction>
        </Stack.Toolbar.Menu>
      </Stack.Toolbar>
      <FlashList
        contentContainerStyle={styles.listContent}
        data={data?.children ?? []}
        keyExtractor={(task) => task.id}
        ListEmptyComponent={
          error ? (
            <View style={styles.emptyWrap}>
              <EmptyState
                action={{ label: t.tasks.loadErrorRetry, onPress: () => void refetch() }}
                description={t.tasks.loadErrorDescription}
                sfSymbol="arrow.clockwise.circle"
                title={t.tasks.loadErrorTitle}
              />
            </View>
          ) : null
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
