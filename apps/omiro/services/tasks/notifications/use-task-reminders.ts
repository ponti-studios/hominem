import { useEffect } from 'react';

import { getTaskService } from '../task-service-instance';
import { expoReminderScheduler, hasNotificationPermission } from './expo-reminder-scheduler';
import { onReminderAccessGranted } from './reminder-access';
import { planReminders, reconcileReminders } from './task-reminders';

// Keeps the device's local notifications matching the task list. Works offline:
// it reads the local database, never the server. It never asks for permission;
// placing a dated task does (`askForReminders`).
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
          if (planned.length > 0 && !(await hasNotificationPermission())) {
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
    const stopChanges = service.subscribe(() => {
      void run();
    });
    const stopAccess = onReminderAccessGranted(() => {
      void run();
    });
    return () => {
      stopChanges();
      stopAccess();
    };
  }, []);
}
