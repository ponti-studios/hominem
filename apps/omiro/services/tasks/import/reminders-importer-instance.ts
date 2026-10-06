import { storage } from '~/services/storage/mmkv';

import { remindersGateway } from '../reminders-gateway';
import { getTaskService, onTaskDataCleared } from '../task-service-instance';
import { createRemindersImporter } from './reminders-import';

let importer: ReturnType<typeof createRemindersImporter> | null = null;

export function getRemindersImporter() {
  if (!importer) {
    const tasks = getTaskService();
    importer = createRemindersImporter({
      reminders: remindersGateway,
      tasks,
      storage: {
        get: (key) => storage.getString(key),
        set: (key, value) => storage.set(key, value),
        remove: (key) => {
          storage.remove(key);
        },
      },
    });
    const created = importer;
    onTaskDataCleared(() => created.reset());
  }
  return importer;
}
