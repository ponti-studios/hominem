import type { Task } from '@hominem/rpc/types';
import { FlashList, type ListRenderItem } from '@shopify/flash-list';
import { Stack, useIsFocused, useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, RefreshControl, View } from 'react-native';

import { SwipeableTaskRow } from '~/components/tasks/SwipeableTaskRow';
import { TaskEditorSheet, type TaskEditorValues } from '~/components/tasks/TaskEditorSheet';
import { TaskListItem } from '~/components/tasks/TaskListItem';
import { makeStyles } from '~/components/theme';
import { EmptyState } from '~/components/ui/EmptyState';
import { INBOX_ROUTE } from '~/services/navigation/routes';
import { useTaskComplete } from '~/services/tasks/use-task-complete';
import { useTaskCreate } from '~/services/tasks/use-task-create';
import { useTaskDelete } from '~/services/tasks/use-task-delete';
import { useTaskQuery } from '~/services/tasks/use-task-query';
import { useTaskUpdate } from '~/services/tasks/use-task-update';
import t from '~/translations';

type EditorState = { mode: 'create' } | { mode: 'edit'; task: Task; isChild: boolean } | null;

export default function TaskDetailScreen() {
  const styles = useStyles();
  const navigation = useNavigation();
  const router = useRouter();
  const isFocused = useIsFocused();
  const { id } = useLocalSearchParams<{ id: string }>();
  const canGoBack = navigation.canGoBack();
  const { data, error, isFetching, refetch } = useTaskQuery({ taskId: id, enabled: isFocused });
  const { mutate: toggleComplete } = useTaskComplete({ parentId: id });
  const { mutate: deleteChild } = useTaskDelete({ parentId: id });
  const { mutate: deleteList } = useTaskDelete();
  const { mutate: createTask, isPending: isCreating } = useTaskCreate({ parentId: id });
  const [editorState, setEditorState] = useState<EditorState>(null);
  const { mutate: updateTask, isPending: isUpdating } = useTaskUpdate({
    parentId: editorState?.mode === 'edit' && editorState.isChild ? id : undefined,
  });

  const handleDeleteList = useCallback(() => {
    Alert.alert(t.tasks.deleteList.title, t.tasks.deleteList.message, [
      { text: t.tasks.deleteList.cancel, style: 'cancel' },
      {
        text: t.tasks.deleteList.confirm,
        style: 'destructive',
        onPress: () => {
          deleteList(id, {
            onSuccess: () => (canGoBack ? router.back() : router.replace(INBOX_ROUTE)),
          });
        },
      },
    ]);
  }, [canGoBack, deleteList, id, router]);

  const handleEditParent = useCallback(() => {
    if (!data) return;
    setEditorState({ mode: 'edit', task: data.task, isChild: false });
  }, [data]);

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

  const renderItem = useCallback<ListRenderItem<Task>>(
    ({ item }) => (
      <SwipeableTaskRow onDelete={() => deleteChild(item.id)}>
        <TaskListItem
          task={item}
          onPress={() => setEditorState({ mode: 'edit', task: item, isChild: true })}
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
      {!canGoBack ? (
        <Stack.Toolbar placement="left">
          <Stack.Toolbar.Button icon="chevron.left" onPress={() => router.replace(INBOX_ROUTE)}>
            Inbox
          </Stack.Toolbar.Button>
        </Stack.Toolbar>
      ) : null}
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button
          accessibilityLabel={t.tasks.addSubtaskA11y}
          icon="plus"
          onPress={() => setEditorState({ mode: 'create' })}
        />
        <Stack.Toolbar.Menu accessibilityLabel={t.tasks.itemActionsA11y} icon="ellipsis">
          <Stack.Toolbar.MenuAction icon="pencil" onPress={handleEditParent}>
            {t.tasks.editA11y}
          </Stack.Toolbar.MenuAction>
          <Stack.Toolbar.MenuAction icon="trash" destructive onPress={handleDeleteList}>
            {t.tasks.deleteList.menu}
          </Stack.Toolbar.MenuAction>
        </Stack.Toolbar.Menu>
      </Stack.Toolbar>
      <FlashList
        contentContainerStyle={styles.listContent}
        contentInsetAdjustmentBehavior="automatic"
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
