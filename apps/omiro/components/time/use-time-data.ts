import { useIsFocused } from 'expo-router';
import { useMemo } from 'react';

import {
  useCalendarEvents,
  useCalendarPermission,
  useConnectCalendar,
} from '~/services/calendar/calendar-queries';
import { useTasksQuery } from '~/services/tasks/use-tasks-query';

import { useTimePreview } from './time-preview-store';
import { buildDayIndex } from './time-utils';

// Everything the Time screen reads: calendar events (device-only, permission
// gated), tasks, and the per-day index built from both. A dev preview
// scenario, when chosen, replaces the real data.
export function useTimeData() {
  const isFocused = useIsFocused();
  const { scenario } = useTimePreview();
  const { data: permission = null } = useCalendarPermission({ enabled: isFocused });
  const calendar = useCalendarEvents({ enabled: isFocused && permission === 'authorized' });
  const { data: tasks = [] } = useTasksQuery({ enabled: isFocused });
  const connectCalendar = useConnectCalendar();

  const events = scenario ? scenario.events : calendar.events;
  const allTasks = scenario ? scenario.tasks : tasks;
  const dayIndex = useMemo(() => buildDayIndex({ events, tasks: allTasks }), [allTasks, events]);

  return {
    allTasks,
    calendar,
    connectCalendar,
    dayIndex,
    error: calendar.error ?? connectCalendar.error,
    isLoadingEvents: scenario ? false : calendar.isLoadingEvents,
    permission,
  };
}
