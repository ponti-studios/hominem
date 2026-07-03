import type { TaskListItem as TaskListItemModel } from '@hominem/rpc/types';
import { FlashList, type ListRenderItem } from '@shopify/flash-list';
import { Stack, useIsFocused, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { RefreshControl, View } from 'react-native';

import { SwipeableTaskRow } from '~/components/tasks/SwipeableTaskRow';
import { TaskEditorSheet, type TaskEditorValues } from '~/components/tasks/TaskEditorSheet';
import { TaskListItem } from '~/components/tasks/TaskListItem';
import { makeStyles } from '~/components/theme';
import { EmptyState } from '~/components/ui/EmptyState';
import { getTaskDetailRoute } from '~/services/navigation/routes';
import { useTaskComplete } from '~/services/tasks/use-task-complete';
import { useTaskCreate } from '~/services/tasks/use-task-create';
import { useTaskDelete } from '~/services/tasks/use-task-delete';
import { useTaskUpdate } from '~/services/tasks/use-task-update';
import { useTasksQuery } from '~/services/tasks/use-tasks-query';
import t from '~/translations';

type EditorState = { mode: 'create' } | { mode: 'edit'; task: TaskListItemModel } | null;

export default function TasksScreen() {
  const styles = useStyles();
  const isFocused = useIsFocused();
  const router = useRouter();
  const { data: tasks = [], error, isFetching, refetch } = useTasksQuery({ enabled: isFocused });
  const { mutate: toggleComplete } = useTaskComplete();
  const { mutate: deleteTask } = useTaskDelete();
  const { mutate: createTask, isPending: isCreating } = useTaskCreate();
  const { mutate: updateTask, isPending: isUpdating } = useTaskUpdate();
  const [editorState, setEditorState] = useState<EditorState>(null);

  const handlePressTask = useCallback((task: TaskListItemModel) => {
    if ((task.childCount ?? 0) > 0) {
      router.push(getTaskDetailRoute(task.id));
      return;
    }
    setEditorState({ mode: 'edit', task });
  }, [router]);

  const handleSubmitEditor = useCallback(
    (values: TaskEditorValues) => {
      if (editorState?.mode === 'edit') {
        updateTask(
          { taskId: editorState.task.id, ...values },
          { onSuccess: () => setEditorState(null) },
        );
        return;
      }
      createTask(values, { onSuccess: () => setEditorState(null) });
    },
    [createTask, editorState, updateTask],
  );

  const renderItem = useCallback<ListRenderItem<TaskListItemModel>>(
    ({ item }) => (
      <SwipeableTaskRow isList={(item.childCount ?? 0) > 0} onDelete={() => deleteTask(item.id)}>
        <TaskListItem
          task={item}
          onPress={() => handlePressTask(item)}
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
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button
          accessibilityLabel={t.tasks.addTaskA11y}
          icon="plus"
          onPress={() => setEditorState({ mode: 'create' })}
        />
      </Stack.Toolbar>
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
                action={{
                  label: t.tasks.emptyAction,
                  onPress: () => setEditorState({ mode: 'create' }),
                }}
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
      <TaskEditorSheet
        visible={editorState !== null}
        mode={editorState?.mode ?? 'create'}
        isSubmitting={editorState?.mode === 'edit' ? isUpdating : isCreating}
        initialValues={
          editorState?.mode === 'edit'
            ? {
                title: editorState.task.title,
                description: editorState.task.description,
                priority: editorState.task.priority as TaskEditorValues['priority'],
                dueAt: editorState.task.dueAt,
              }
            : undefined
        }
        onClose={() => setEditorState(null)}
        onSubmit={handleSubmitEditor}
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
