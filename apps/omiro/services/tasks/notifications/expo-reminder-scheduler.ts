import * as Notifications from 'expo-notifications';

import type { BriefScheduler } from './morning-brief';
import { REMINDER_ACTION, REMINDER_CATEGORY } from './reminder-actions';
import type { ReminderScheduler } from './task-reminders';

const PREFIX = 'task-';
const BRIEF_PREFIX = 'brief-';

export async function hasNotificationPermission(): Promise<boolean> {
  return (await Notifications.getPermissionsAsync()).granted;
}

// Shows the system prompt the first time; never again once the user has answered.
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
              actionable: request.content.categoryIdentifier === REMINDER_CATEGORY,
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
      content: {
        categoryIdentifier: REMINDER_CATEGORY,
        data: { taskId, at: at.getTime() },
        title,
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at },
    });
  },
  cancel: async (taskId) => {
    await Notifications.cancelScheduledNotificationAsync(`${PREFIX}${taskId}`);
  },
};

// Gives task reminders their Done and "In an hour" buttons. Neither opens the
// app: the change is applied in the background.
export const registerReminderActions = () =>
  Notifications.setNotificationCategoryAsync(REMINDER_CATEGORY, [
    {
      buttonTitle: 'Done',
      identifier: REMINDER_ACTION.complete,
      options: { opensAppToForeground: false },
    },
    {
      buttonTitle: 'In an hour',
      identifier: REMINDER_ACTION.snooze,
      options: { opensAppToForeground: false },
    },
  ]);

interface ReminderResponse {
  actionIdentifier: string;
  taskId: unknown;
}

// Calls back with every button pressed on a task reminder, including the one
// that launched the app.
export function onReminderResponse(listener: (response: ReminderResponse) => void) {
  const deliver = (response: Notifications.NotificationResponse) =>
    listener({
      actionIdentifier: response.actionIdentifier,
      taskId: response.notification.request.content.data?.['taskId'],
    });
  const launchResponse = Notifications.getLastNotificationResponse();
  if (launchResponse) {
    deliver(launchResponse);
    Notifications.clearLastNotificationResponse();
  }
  const subscription = Notifications.addNotificationResponseReceivedListener(deliver);
  return () => subscription.remove();
}

export const expoBriefScheduler: BriefScheduler = {
  scheduled: async () =>
    (await Notifications.getAllScheduledNotificationsAsync()).flatMap((request) =>
      request.identifier.startsWith(BRIEF_PREFIX)
        ? [request.identifier.slice(BRIEF_PREFIX.length)]
        : [],
    ),
  schedule: async ({ at, body, day, title }) => {
    await Notifications.scheduleNotificationAsync({
      identifier: `${BRIEF_PREFIX}${day}`,
      content: { body, title },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at },
    });
  },
  cancel: async (day) => {
    await Notifications.cancelScheduledNotificationAsync(`${BRIEF_PREFIX}${day}`);
  },
};
