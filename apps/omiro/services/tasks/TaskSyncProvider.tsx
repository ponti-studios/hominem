import { useApiClient } from '@hominem/rpc/react';
import { focusManager, onlineManager, useQueryClient } from '@tanstack/react-query';
import { useEffect, type ReactNode } from 'react';

import { getRemindersImporter } from './import/reminders-importer-instance';
import { taskKeys } from './query-keys';
import { createRpcTaskSyncApi } from './sync/rpc-task-sync-api';
import { getTaskService, setTaskSyncApi } from './task-service-instance';

// Keeps the local task database and the server in step while signed in: sync
// at start, whenever the app returns to the foreground or the network comes
// back, and refresh the Tasks query whenever the local data changes.
export function TaskSyncProvider({ children }: { children: ReactNode }) {
  const client = useApiClient();
  const queryClient = useQueryClient();

  useEffect(() => {
    const service = getTaskService();
    setTaskSyncApi(createRpcTaskSyncApi(client));

    const importer = getRemindersImporter();
    const stopChanges = service.subscribe(() => {
      // Imported reminders leave Reminders once the server has their tasks.
      void importer.settle().catch(() => undefined);
      void queryClient.invalidateQueries({ queryKey: taskKeys.all });
    });
    const stopOnline = onlineManager.subscribe((online) => {
      if (online) {
        void service.sync();
      }
    });
    const stopFocus = focusManager.subscribe((focused) => {
      if (focused) {
        void service.sync();
      }
    });
    void service.sync();

    return () => {
      stopChanges();
      stopOnline();
      stopFocus();
      setTaskSyncApi(null);
    };
  }, [client, queryClient]);

  return children;
}
