import type { StoredTask } from '../sync/task-mapping';
import { ensureNotificationPermission } from './expo-reminder-scheduler';
import { reminderTime } from './task-reminders';

const grantedListeners = new Set<() => void>();

// Called when notification access is granted, so scheduling can catch up.
export function onReminderAccessGranted(listener: () => void) {
  grantedListeners.add(listener);
  return () => {
    grantedListeners.delete(listener);
  };
}

// Reminders are what a day gives a task, so this is where the system prompt
// belongs: the moment someone places a task on a future day or time.
export async function askForReminders(task: Pick<StoredTask, 'startAt' | 'dueAt'>) {
  const at = reminderTime(task);
  if (!at || at.getTime() <= Date.now()) {
    return;
  }
  try {
    if (await ensureNotificationPermission()) {
      grantedListeners.forEach((listener) => listener());
    }
  } catch {
    // No notification support (or a denied prompt) just means no reminders.
  }
}
