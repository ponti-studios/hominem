import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useState } from 'react';

import { taskKeys } from '../query-keys';
import type { ImportState } from './reminders-import';
import { getRemindersImporter } from './reminders-importer-instance';

// Drives the first-run prompt on the Tasks tab. Any failure reads as "nothing
// to ask", so a Reminders problem never blocks the tab.
export function useRemindersImport() {
  const queryClient = useQueryClient();
  const [state, setState] = useState<ImportState>({ kind: 'done' });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    getRemindersImporter()
      .state()
      .then((next) => {
        if (active) {
          setState(next);
        }
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  const importAll = useCallback(async () => {
    setBusy(true);
    try {
      await getRemindersImporter().importAll();
    } catch {
      // Leave the prompt up so the user can try again.
      setBusy(false);
      return;
    }
    setState({ kind: 'done' });
    setBusy(false);
    void queryClient.invalidateQueries({ queryKey: taskKeys.all });
  }, [queryClient]);

  const startFresh = useCallback(() => {
    getRemindersImporter().startFresh();
    setState({ kind: 'done' });
  }, []);

  return { state, busy, importAll, startFresh };
}
