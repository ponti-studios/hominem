import type { TaskListItem as TaskListItemModel } from '@hominem/rpc/types';
import { FlashList, type ListRenderItem } from '@shopify/flash-list';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, RefreshControl, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { VoiceRecordingPanel } from '~/components/composer/VoiceRecordingPanel';
import { colors, makeStyles, radii, Text, themeSpacing } from '~/components/theme';
import { EmptyState } from '~/components/ui/EmptyState';
import AppIcon from '~/components/ui/icon';
import { getTaskDetailRoute } from '~/services/navigation/routes';
import { useTaskComplete } from '~/services/tasks/use-task-complete';
import { useTaskCreate } from '~/services/tasks/use-task-create';
import { useTaskDelete } from '~/services/tasks/use-task-delete';
import { useTaskUpdate } from '~/services/tasks/use-task-update';
import {
  getTaskVoiceCaptureErrorPresentation,
  useTaskVoiceCapture,
} from '~/services/tasks/use-task-voice-capture';
import { useTasksQuery } from '~/services/tasks/use-tasks-query';
import t from '~/translations';

import { SwipeableTaskRow } from './SwipeableTaskRow';
import { TaskEditorSheet, type TaskEditorValues } from './TaskEditorSheet';
import { TaskListItem } from './TaskListItem';

const TASKS_EMPTY_STATE_ASSET = require('~/assets/states/tasks.empty.png');

type EditorState = { mode: 'create' } | { mode: 'edit'; task: TaskListItemModel } | null;

interface TasksPaneProps {
  isFocused: boolean;
  searchQuery?: string;
}

/**
 * The Tasks list, editor, voice-capture UI, and its own floating add/voice
 * buttons — fully self-contained so it can be embedded as the Tasks context
 * inside the Workspace without duplicating logic or fighting the host
 * screen's toolbar.
 */
export function TasksPane({ isFocused, searchQuery = '' }: TasksPaneProps) {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { data: tasks = [], error, isFetching, refetch } = useTasksQuery({ enabled: isFocused });
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const visibleTasks = tasks.filter(
    (task) =>
      !normalizedQuery ||
      [task.title, task.description].some((value) =>
        value?.toLowerCase().includes(normalizedQuery),
      ),
  );
  const { mutate: toggleComplete } = useTaskComplete();
  const { mutate: deleteTask } = useTaskDelete();
  const { mutate: createTask, isPending: isCreating } = useTaskCreate();
  const { mutate: updateTask, isPending: isUpdating } = useTaskUpdate();
  const [editorState, setEditorState] = useState<EditorState>(null);
  const voiceCapture = useTaskVoiceCapture();
  const [voiceResult, setVoiceResult] = useState<number | null>(null);
  const previousVoiceStateRef = useRef(voiceCapture.state);
  const showEmptyState = visibleTasks.length === 0 && (Boolean(error) || !isFetching);

  useEffect(() => {
    const previousState = previousVoiceStateRef.current;
    previousVoiceStateRef.current = voiceCapture.state;
    if (previousState !== 'creating' || voiceCapture.state !== 'idle') return;

    const count = voiceCapture.createdCount ?? 0;
    setVoiceResult(count);
    if (count > 0) {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    const timer = setTimeout(() => setVoiceResult(null), 2500);
    return () => clearTimeout(timer);
  }, [voiceCapture.state, voiceCapture.createdCount]);

  const handlePressTask = useCallback(
    (task: TaskListItemModel) => {
      if ((task.childCount ?? 0) > 0) {
        router.push(getTaskDetailRoute(task.id));
        return;
      }
      setEditorState({ mode: 'edit', task });
    },
    [router],
  );

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
      {showEmptyState ? (
        <View style={styles.emptyWrap}>
          {error ? (
            <EmptyState
              action={{ label: t.tasks.loadErrorRetry, onPress: () => void refetch() }}
              sfSymbol="arrow.clockwise.circle"
              title={t.tasks.loadErrorTitle}
            />
          ) : (
            <EmptyState imageSource={TASKS_EMPTY_STATE_ASSET} title={t.tasks.emptyTitle} />
          )}
        </View>
      ) : (
        <FlashList
          contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 96 }]}
          contentInsetAdjustmentBehavior="automatic"
          data={visibleTasks}
          keyExtractor={(task) => task.id}
          refreshControl={
            <RefreshControl refreshing={isFetching} onRefresh={() => void refetch()} />
          }
          renderItem={renderItem}
          showsVerticalScrollIndicator={false}
        />
      )}
      {voiceCapture.state === 'recording' ? (
        <View style={[styles.voiceBar, { bottom: insets.bottom }]}>
          <VoiceRecordingPanel
            startedAt={voiceCapture.recordingStartedAt}
            onCancel={() => void voiceCapture.cancelVoiceCapture()}
            onDone={() => void voiceCapture.handleMicPress()}
            doneAccessibilityLabel={t.tasks.voice.stopA11y}
          />
        </View>
      ) : null}
      {voiceCapture.state === 'transcribing' || voiceCapture.state === 'creating' ? (
        <View style={[styles.voiceBar, { bottom: insets.bottom }]}>
          <Text color="text-secondary">
            {voiceCapture.state === 'transcribing'
              ? t.tasks.voice.transcribing
              : t.tasks.voice.creating}
          </Text>
        </View>
      ) : null}
      {voiceCapture.state === 'failed' && voiceCapture.error ? (
        <View style={[styles.voiceBar, { bottom: insets.bottom }]}>
          <Text color="destructive" onPress={voiceCapture.clearError}>
            {`${getTaskVoiceCaptureErrorPresentation(voiceCapture.error.code).message} · ${t.tasks.voice.dismissErrorHint}`}
          </Text>
          {voiceCapture.error.transcript ? (
            <Text color="text-secondary" numberOfLines={3}>
              {t.tasks.voice.transcriptLabel(voiceCapture.error.transcript)}
            </Text>
          ) : null}
        </View>
      ) : null}
      {voiceCapture.state === 'idle' && voiceResult !== null ? (
        <View style={[styles.voiceBar, { bottom: insets.bottom }]}>
          <Text color="text-secondary">
            {voiceResult > 0 ? t.tasks.voice.createdCount(voiceResult) : t.tasks.voice.noTasksFound}
          </Text>
        </View>
      ) : null}

      {voiceCapture.state === 'idle' ? (
        <View style={[styles.floatingActions, { bottom: insets.bottom + themeSpacing.lg }]}>
          <Pressable
            accessibilityLabel={t.tasks.voice.startA11y}
            disabled={voiceCapture.isRecordingElsewhere}
            hitSlop={themeSpacing.sm}
            onPress={() => void voiceCapture.handleMicPress()}
            style={({ pressed }) => [
              styles.floatingButton,
              styles.floatingButtonSecondary,
              pressed && styles.floatingButtonPressed,
            ]}
            testID="tasks-voice-button"
          >
            <AppIcon name="mic.fill" size={20} tintColor={colors['text-primary']} />
          </Pressable>
          <Pressable
            accessibilityLabel={t.tasks.addTaskA11y}
            hitSlop={themeSpacing.sm}
            onPress={() => setEditorState({ mode: 'create' })}
            style={({ pressed }) => [
              styles.floatingButton,
              styles.floatingButtonPrimary,
              pressed && styles.floatingButtonPressed,
            ]}
            testID="tasks-add-button"
          >
            <AppIcon name="plus" size={22} tintColor={colors['text-on-accent']} />
          </Pressable>
        </View>
      ) : null}

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

const useStyles = makeStyles(() => ({
  container: {
    flex: 1,
  },
  emptyWrap: {
    flex: 1,
  },
  floatingActions: {
    flexDirection: 'row',
    gap: themeSpacing.md,
    position: 'absolute',
    right: themeSpacing.lg,
  },
  floatingButton: {
    alignItems: 'center',
    borderRadius: radii.full,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  floatingButtonPressed: {
    opacity: 0.8,
  },
  floatingButtonPrimary: {
    backgroundColor: colors.accent,
  },
  floatingButtonSecondary: {
    backgroundColor: colors['surface-inset'],
  },
  listContent: {
    flexGrow: 1,
    paddingBottom: 24,
  },
  voiceBar: {
    backgroundColor: colors['surface-canvas'],
    borderTopColor: colors['border-subtle'],
    borderTopWidth: 1,
    left: 0,
    paddingHorizontal: 16,
    paddingVertical: 12,
    position: 'absolute',
    right: 0,
  },
}));
