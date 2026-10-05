import { MenuView, type MenuAction, type NativeActionEvent } from '@expo/ui/community/menu';
import { useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Text, View } from 'react-native';

import { useTabBarInset } from '~/components/navigation/tab-bar-inset';
import { useStyles } from '~/components/theme';
import { IconButton } from '~/components/ui';
import { calendarEventGateway } from '~/services/calendar/calendar-event-gateway';
import { calendarKeys } from '~/services/calendar/calendar-queries';
import type { TaskListItem } from '~/services/tasks/task-types';
import { useTaskComplete } from '~/services/tasks/use-task-complete';

import AppIcon from '../ui/icon';
import { useTimePreview } from './time-preview-store';
import type { TimeItem } from './time-types';
import { getUnscheduledTasks, localDayKey, startOfToday, stripDays } from './time-utils';
import { CAPTURE_BAR_HEIGHT, CAPTURE_CHIPS_HEIGHT, TimeCaptureBar } from './TimeCaptureBar';
import { TimeDayList } from './TimeDayList';
import { TimeDayStrip } from './TimeDayStrip';
import { TimeInboxSheet } from './TimeInboxSheet';
import { TimeResultSheet } from './TimeResultSheet';
import { TimeTaskDetailSheet } from './TimeTaskDetailSheet';
import { TimeToast, type TimeToastModel } from './TimeToast';
import { useTimeComposer } from './use-time-composer';
import { useTimeData } from './use-time-data';
import { useTimePromptParam } from './use-time-prompt-param';

const STRIP_DAYS = 14;
const NOW_TICK_MS = 60_000;
const SUCCESS_TOAST_MS = 2600;

function useNow(intervalMs: number) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}

interface TimeScreenProps {
  // Set by a `?prompt=` link; prefills the capture bar (see use-time-prompt-param).
  initialPrompt?: string;
}

export function TimeScreen({ initialPrompt }: TimeScreenProps = {}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const safeAreaBottom = useTabBarInset();
  const now = useNow(NOW_TICK_MS);
  const data = useTimeData();
  const { mutate: toggleTask } = useTaskComplete();

  const todayKey = localDayKey(now);
  const [selectedKey, setSelectedKey] = useState(todayKey);
  const [inboxOpen, setInboxOpen] = useState(false);
  const [detailTaskId, setDetailTaskId] = useState<string | null>(null);
  const [toast, setToast] = useState<TimeToastModel | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastCounter = useRef(0);

  const days = useMemo(() => stripDays(startOfToday(), STRIP_DAYS), [todayKey]);
  const daysWithItems = useMemo(() => new Set(data.dayIndex.keys()), [data.dayIndex]);
  const dayItems = data.dayIndex.get(selectedKey) ?? EMPTY_ITEMS;
  const unscheduled = useMemo(() => getUnscheduledTasks(data.allTasks), [data.allTasks]);
  const detailTask = useMemo(
    () => data.allTasks.find((task) => task.id === detailTaskId) ?? null,
    [data.allTasks, detailTaskId],
  );

  const dismissToast = useCallback(() => {
    if (toastTimer.current) {
      clearTimeout(toastTimer.current);
      toastTimer.current = null;
    }
    setToast(null);
  }, []);

  const showToast = useCallback(
    (next: Omit<TimeToastModel, 'id'>, autoHide = false) => {
      if (toastTimer.current) {
        clearTimeout(toastTimer.current);
      }
      toastCounter.current += 1;
      setToast({ ...next, id: toastCounter.current });
      toastTimer.current = autoHide ? setTimeout(dismissToast, SUCCESS_TOAST_MS) : null;
    },
    [dismissToast],
  );

  useEffect(
    () => () => {
      if (toastTimer.current) {
        clearTimeout(toastTimer.current);
      }
    },
    [],
  );

  const showError = useCallback(
    (message: string, action?: TimeToastModel['action']) =>
      showToast({ action, detail: 'Your words are saved.', message, tone: 'error' }),
    [showToast],
  );

  const openEvent = useCallback(
    async (event: { id: string }) => {
      try {
        const result = await calendarEventGateway.presentEvent(event.id);
        if (result === 'saved' || result === 'deleted') {
          await queryClient.invalidateQueries({ queryKey: calendarKeys.events });
        }
      } catch (error) {
        showError(error instanceof Error ? error.message : 'Unable to open this calendar event.');
      }
    },
    [queryClient, showError],
  );

  const composer = useTimeComposer({
    onError: (message) => showError(message, { label: 'Retry', onPress: () => composer.retry() }),
    onOpenEvent: openEvent,
  });

  const clearPromptParam = useCallback(() => router.setParams({ prompt: undefined }), [router]);
  useTimePromptParam({
    clear: clearPromptParam,
    prompt: initialPrompt,
    setPrompt: composer.setPrompt,
  });

  const completeTask = useCallback(
    (task: TaskListItem) => {
      const completing = task.status !== 'completed';
      toggleTask({ completed: completing, taskId: task.id });
      if (!completing) {
        return;
      }
      const dayTasks = (data.dayIndex.get(todayKey) ?? EMPTY_ITEMS).flatMap((item) =>
        item.kind === 'task' ? [item.value] : [],
      );
      if (!dayTasks.some((candidate) => candidate.id === task.id)) {
        return;
      }
      const done = dayTasks.filter(
        (candidate) => candidate.status === 'completed' || candidate.id === task.id,
      ).length;
      showToast(
        {
          action: {
            label: 'Undo',
            onPress: () => toggleTask({ completed: false, taskId: task.id }),
          },
          badge: `${done}/${dayTasks.length}`,
          detail:
            done === dayTasks.length
              ? 'That’s everything for today'
              : `${dayTasks.length - done} left for today`,
          message:
            done === dayTasks.length
              ? 'All done — nice'
              : `Nice — ${done} of ${dayTasks.length} done`,
          tone: 'success',
        },
        true,
      );
    },
    [data.dayIndex, showToast, toggleTask, todayKey],
  );

  const openItem = useCallback(
    (item: TimeItem) => {
      if (item.kind === 'task') {
        setDetailTaskId(item.value.id);
        return;
      }
      void openEvent(item.value);
    },
    [openEvent],
  );

  const toggleItem = useCallback(
    (item: TimeItem) => {
      if (item.kind === 'task') {
        completeTask(item.value);
      }
    },
    [completeTask],
  );

  const openInboxTask = useCallback((task: TaskListItem) => {
    setInboxOpen(false);
    setDetailTaskId(task.id);
  }, []);

  const findTimeFor = useCallback(
    (task: TaskListItem) => {
      setDetailTaskId(null);
      composer.setPrompt(`Find time for ${task.title}`);
    },
    [composer],
  );

  const handleTaskCreated = useCallback(() => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    showToast(
      {
        badge: '+1',
        detail: 'Find it in your Inbox or on its day',
        message: 'Task added',
        tone: 'success',
      },
      true,
    );
  }, [showToast]);

  const submitDraft = useCallback(async () => {
    const saved = await composer.submitDraft();
    if (saved) {
      handleTaskCreated();
    }
  }, [composer, handleTaskCreated]);

  const refresh = useCallback(() => {
    if (data.permission === 'authorized') {
      void data.calendar.refresh();
    }
  }, [data.calendar, data.permission]);

  useEffect(() => {
    const message = data.error instanceof Error ? data.error.message : null;
    if (message) {
      showError(message);
    }
  }, [data.error, showError]);

  const styles = useStyles((theme) => ({
    container: { backgroundColor: theme.colors.background, flex: 1 },
    header: {
      alignItems: 'flex-end',
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingBottom: 14,
      paddingHorizontal: 20,
      paddingTop: 12,
    },
    weekday: {
      ...theme.textVariants.subhead,
      color: theme.colors.mutedForeground,
      fontWeight: '600',
    },
    date: { ...theme.textVariants.display, color: theme.colors.foreground },
    badge: {
      alignItems: 'center',
      backgroundColor: theme.colors.coral,
      borderRadius: 10,
      height: 20,
      justifyContent: 'center',
      minWidth: 20,
      paddingHorizontal: 5,
      position: 'absolute',
      right: -2,
      top: -2,
    },
    badgeText: {
      ...theme.textVariants.caption1,
      color: theme.colors.primaryForeground,
      fontWeight: '700',
    },
  }));

  const selectedDate = days.find((day) => localDayKey(day) === selectedKey) ?? days[0];
  const listBottom = safeAreaBottom + CAPTURE_BAR_HEIGHT + CAPTURE_CHIPS_HEIGHT + 24;

  return (
    <View style={styles.container} testID="time-screen">
      <View style={styles.header}>
        <View>
          <Text style={styles.weekday}>
            {selectedKey === todayKey
              ? now.toLocaleDateString(undefined, { weekday: 'long' })
              : selectedDate.toLocaleDateString(undefined, { weekday: 'long' })}
          </Text>
          <Text style={styles.date}>
            {selectedDate.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
          </Text>
        </View>
        <View>
          <IconButton
            accessibilityLabel={`Inbox, ${unscheduled.length} tasks`}
            onPress={() => setInboxOpen(true)}
            size="lg"
            testID="time-inbox-button"
            variant="tonal"
          >
            <AppIcon name="tray" size={22} />
          </IconButton>
          {unscheduled.length > 0 ? (
            <View pointerEvents="none" style={styles.badge}>
              <Text style={styles.badgeText}>{unscheduled.length}</Text>
            </View>
          ) : null}
        </View>
      </View>
      <TimeDayStrip
        days={days}
        daysWithItems={daysWithItems}
        onSelect={setSelectedKey}
        selectedKey={selectedKey}
      />
      <TimeDayList
        contentPaddingBottom={listBottom}
        isLoading={data.isLoadingEvents}
        isToday={selectedKey === todayKey}
        items={dayItems}
        now={now}
        onConnectCalendar={() => data.connectCalendar.mutate()}
        onOpenItem={openItem}
        onRefresh={refresh}
        onToggleTask={toggleItem}
        permission={data.permission}
      />
      {toast ? (
        <TimeToast
          bottom={safeAreaBottom + CAPTURE_BAR_HEIGHT + 24}
          key={toast.id}
          onDismiss={() => {
            if (toast.tone === 'error') {
              composer.cancelResult();
            }
            dismissToast();
          }}
          toast={toast}
        />
      ) : null}
      <TimeCaptureBar controller={composer} />
      <TimeResultSheet
        isSaving={composer.isSaving}
        onCancel={composer.cancelResult}
        onChooseEvent={composer.chooseEvent}
        onChooseOpening={composer.chooseOpening}
        onEditField={composer.updateDraft}
        onSubmitDraft={submitDraft}
        state={composer.interaction}
      />
      <TimeInboxSheet
        onClose={() => setInboxOpen(false)}
        onOpenTask={openInboxTask}
        onToggleTask={completeTask}
        tasks={unscheduled}
        visible={inboxOpen}
      />
      <TimeTaskDetailSheet
        onClose={() => setDetailTaskId(null)}
        onError={(message) => showError(message)}
        onFindTime={findTimeFor}
        task={detailTask}
      />
    </View>
  );
}

const EMPTY_ITEMS: TimeItem[] = [];

export function TimeHeaderActions() {
  return __DEV__ ? <TimePreviewMenuButton /> : null;
}

// __DEV__ only: lets a dev preview the Time screen with fixture data
// (busy weeks, overlapping times, empty state) without a real calendar or
// task backend. See time-preview-scenarios.ts.
function TimePreviewMenuButton() {
  const { scenario, scenarios, setScenarioId } = useTimePreview();

  const actions: MenuAction[] = [
    ...scenarios.map((candidate) => ({
      id: candidate.id,
      title: candidate.label,
      state: scenario?.id === candidate.id ? ('on' as const) : undefined,
    })),
    {
      id: 'real-data',
      title: 'Real data',
      state: scenario == null ? ('on' as const) : undefined,
    },
  ];

  const onPressAction = (event: NativeActionEvent) => {
    const id = event.nativeEvent.event;
    setScenarioId(id === 'real-data' ? null : id);
  };

  return (
    <MenuView actions={actions} onPressAction={onPressAction} testID="time-preview-menu-button">
      <IconButton
        accessibilityLabel="Preview Time with fixture data"
        testID="time-preview-menu-button"
        variant="plain"
      >
        <AppIcon name={scenario ? 'flask.fill' : 'flask'} size={22} />
      </IconButton>
    </MenuView>
  );
}
