import { useEffect } from 'react';

import { subscribeToStorageKey } from '~/services/storage/mmkv';

import { getTaskService } from '../task-service-instance';
import {
  expoBriefScheduler,
  expoReminderScheduler,
  hasNotificationPermission,
  onReminderResponse,
  registerReminderActions,
} from './expo-reminder-scheduler';
import {
  getMorningBriefEnabled,
  MORNING_BRIEF_KEY,
  planMorningBriefs,
  reconcileBriefs,
} from './morning-brief';
import { onReminderAccessGranted } from './reminder-access';
import { applyReminderAction } from './reminder-actions';
import { planReminders, reconcileReminders } from './task-reminders';

// Keeps the device's local notifications matching the task list. Works offline:
// it reads the local database, never the server. It never asks for permission;
// placing a dated task does (`askForReminders`). Also applies the reminder's
// own buttons (Done, In an hour) to the task they were pressed on.
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
          const tasks = service.list();
          const now = new Date();
          const planned = planReminders(tasks, now);
          const briefs = getMorningBriefEnabled() ? planMorningBriefs(tasks, now) : [];
          if (planned.length + briefs.length > 0 && !(await hasNotificationPermission())) {
            return;
          }
          await reconcileReminders(expoReminderScheduler, planned);
          await reconcileBriefs(expoBriefScheduler, briefs);
        } while (again);
      } catch {
        // A scheduling hiccup must not disturb the Tasks tab; the next change retries.
      } finally {
        running = false;
      }
    };

    void registerReminderActions().catch(() => undefined);
    const stopResponses = onReminderResponse((response) => {
      if (applyReminderAction(service, response, new Date())) {
        void service.sync();
      }
    });

    void run();
    const stopChanges = service.subscribe(() => {
      void run();
    });
    const stopAccess = onReminderAccessGranted(() => {
      void run();
    });
    const stopBriefSetting = subscribeToStorageKey(MORNING_BRIEF_KEY, () => {
      void run();
    });
    return () => {
      stopResponses();
      stopChanges();
      stopAccess();
      stopBriefSetting();
    };
  }, []);
}
