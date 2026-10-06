import { useEffect } from 'react';

import { getTaskService } from '../task-service-instance';
import { ensureNotificationPermission, expoReminderScheduler } from './expo-reminder-scheduler';
import { planReminders, reconcileReminders } from './task-reminders';

// Keeps the device's local notifications matching the task list. Works offline:
// it reads the local database, never the server.
export function useTaskReminders() {
  useEffect(() => {
    const service = getTaskService();
    let running = false;
    let again = false;

    const run = async () => {
      if (running) {
        again = true;
        return;
      }
      running = true;
      try {
        do {
          again = false;
          const planned = planReminders(service.list(), new Date());
          if (planned.length > 0 && !(await ensureNotificationPermission())) {
            return;
          }
          await reconcileReminders(expoReminderScheduler, planned);
        } while (again);
      } catch {
        // A scheduling hiccup must not disturb the Tasks tab; the next change retries.
      } finally {
        running = false;
      }
    };

    void run();
    return service.subscribe(() => {
      void run();
    });
  }, []);
}
