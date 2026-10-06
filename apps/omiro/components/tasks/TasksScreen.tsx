import { useRouter } from 'expo-router';
import { useState } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';

import { ComposerDock, useComposerDockMetrics } from '~/components/composer/ComposerDock';
import { useStyles } from '~/components/theme';
import { useRemindersImport } from '~/services/tasks/import/use-reminders-import';
import type { TaskListItem } from '~/services/tasks/task-types';
import { useTaskComplete } from '~/services/tasks/use-task-complete';
import { useTaskDelete } from '~/services/tasks/use-task-delete';
import { useTaskUpdate } from '~/services/tasks/use-task-update';
import { useTasksQuery } from '~/services/tasks/use-tasks-query';

import { CarriedOverCard } from './CarriedOverCard';
import { ImportPrompt } from './ImportPrompt';
import { InboxRow } from './InboxRow';
import { MoveSheet } from './MoveSheet';
import { getInboxTasks, groupTasks, moveToDayPatch } from './task-time';
import { TaskComposer } from './TaskComposer';
import { TaskDetailSheet } from './TaskDetailSheet';
import { TaskRow } from './TaskList';
import { TaskSectionHeader } from './TaskSectionHeader';
import { TodayClearCard } from './TodayClearCard';

// The Tasks page: what was left from earlier days, today, and the next few
// days, then a single "to place" row for tasks with no day yet.
export function TasksScreen() {
  const { data: tasks = [], isRefetching, refetch } = useTasksQuery();
  const { mutate: toggleTask } = useTaskComplete();
  const update = useTaskUpdate();
  const remove = useTaskDelete();
  const reminders = useRemindersImport();
  const router = useRouter();
  const { inset: composerInset, restingInset } = useComposerDockMetrics({ clearance: 16 });
  const [detailTaskId, setDetailTaskId] = useState<string | null>(null);
  const [movingTaskId, setMovingTaskId] = useState<string | null>(null);

  const sections = groupTasks(tasks);
  const inboxCount = getInboxTasks(tasks).length;
  const detailTask = tasks.find((task) => task.id === detailTaskId) ?? null;
  const movingTask = tasks.find((task) => task.id === movingTaskId) ?? null;
  const showToday = sections.today.length > 0 || sections.doneToday > 0;
  const isEmpty =
    !showToday &&
    sections.carriedOver.length === 0 &&
    sections.upcoming.length === 0 &&
    inboxCount === 0 &&
    reminders.state.kind !== 'ask';

  const styles = useStyles((theme) => ({
    container: { backgroundColor: theme.colors.background, flex: 1 },
    list: { flex: 1 },
    content: { gap: 10, paddingHorizontal: 16, paddingTop: 6 },
    more: {
      ...theme.textVariants.footnote,
      color: theme.colors.mutedForeground,
      fontWeight: '700',
      paddingVertical: 2,
      textAlign: 'center',
    },
    empty: {
      ...theme.textVariants.callout,
      color: theme.colors.mutedForeground,
      paddingVertical: 24,
      textAlign: 'center',
    },
    inbox: { paddingTop: 4 },
  }));

  const refreshControl = <RefreshControl onRefresh={refetch} refreshing={isRefetching} />;
  const open = (task: TaskListItem) => setDetailTaskId(task.id);
  const toggle = (task: TaskListItem) =>
    toggleTask({ completed: task.status !== 'completed', taskId: task.id });

  return (
    <View style={styles.container} testID="unscheduled-tasks-screen">
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: composerInset + 16 }]}
        contentInsetAdjustmentBehavior="automatic"
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        style={styles.list}
        refreshControl={refreshControl}
        scrollIndicatorInsets={{ bottom: composerInset }}
        showsVerticalScrollIndicator={false}
        testID="unscheduled-task-list"
      >
        {reminders.state.kind === 'ask' ? (
          <ImportPrompt
            busy={reminders.busy}
            count={reminders.state.count}
            onImport={reminders.importAll}
            onStartFresh={reminders.startFresh}
          />
        ) : null}

        {sections.carriedOver.length > 0 ? (
          <>
            <TaskSectionHeader detail={`${sections.carriedOver.length}`} title="Carried over" />
            {sections.carriedOver.map((task) => (
              <CarriedOverCard
                key={task.id}
                onDone={toggle}
                onDrop={(dropped) => remove.mutate(dropped.id)}
                onMove={(moved) => setMovingTaskId(moved.id)}
                onOpen={open}
                task={task}
              />
            ))}
          </>
        ) : null}

        {showToday ? (
          <>
            <TaskSectionHeader
              detail={sections.today.length > 0 ? `${sections.today.length} left` : undefined}
              title="Today"
            />
            {sections.today.length === 0 ? <TodayClearCard /> : null}
            {sections.today.map((task) => (
              <TaskRow item={task} key={task.id} onGround onOpen={open} onToggle={toggle} />
            ))}
          </>
        ) : null}

        {sections.upcoming.length > 0 ? (
          <>
            <TaskSectionHeader title="Upcoming" />
            {sections.upcoming.map((task) => (
              <TaskRow item={task} key={task.id} onGround onOpen={open} onToggle={toggle} />
            ))}
            {sections.moreThisWeek > 0 ? (
              <Text style={styles.more}>{`+${sections.moreThisWeek} this week`}</Text>
            ) : null}
          </>
        ) : null}

        {isEmpty ? <Text style={styles.empty}>You have no open tasks.</Text> : null}

        {inboxCount > 0 ? (
          <View style={styles.inbox}>
            <InboxRow count={inboxCount} onPress={() => router.push('/tasks/place')} />
          </View>
        ) : null}
      </ScrollView>
      <ComposerDock restingInset={restingInset} testID="tasks-composer-dock">
        <TaskComposer />
      </ComposerDock>
      <TaskDetailSheet
        onClose={() => setDetailTaskId(null)}
        onError={() => undefined}
        task={detailTask}
      />
      <MoveSheet
        onClose={() => setMovingTaskId(null)}
        onMove={(task, date) => {
          setMovingTaskId(null);
          update.mutate({ taskId: task.id, patch: moveToDayPatch(task, date) });
        }}
        task={movingTask}
      />
    </View>
  );
}
