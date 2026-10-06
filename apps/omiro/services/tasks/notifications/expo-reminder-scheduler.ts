import * as Notifications from 'expo-notifications';

import type { ReminderScheduler } from './task-reminders';

const PREFIX = 'task-';

// Asks once, and only when there is something to remind about.
export async function ensureNotificationPermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) {
    return true;
  }
  if (!current.canAskAgain) {
    return false;
  }
  return (await Notifications.requestPermissionsAsync()).granted;
}

export const expoReminderScheduler: ReminderScheduler = {
  // The trigger's shape differs by platform, so the time rides in the payload.
  scheduled: async () => {
    const requests = await Notifications.getAllScheduledNotificationsAsync();
    return requests.flatMap((request) => {
      const at: unknown = request.content.data?.['at'];
      return request.identifier.startsWith(PREFIX) && typeof at === 'number'
        ? [
            {
              taskId: request.identifier.slice(PREFIX.length),
              at,
              title: request.content.title ?? '',
            },
          ]
        : [];
    });
  },
  schedule: async ({ taskId, title, at }) => {
    await Notifications.scheduleNotificationAsync({
      identifier: `${PREFIX}${taskId}`,
      content: { title, data: { taskId, at: at.getTime() } },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at },
    });
  },
  cancel: async (taskId) => {
    await Notifications.cancelScheduledNotificationAsync(`${PREFIX}${taskId}`);
  },
};
