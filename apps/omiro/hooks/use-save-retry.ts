import { useEffect, useRef } from 'react';

import type { NoteSaveStatus } from './use-note-editor';

/**
 * Sends the note again, once, when the connection comes back after edits were left waiting offline.
 *
 * The save that was in flight when the connection dropped can fail only after the connection is back,
 * so this keys on "edits were waiting while offline" instead of on seeing the offline-to-online flip
 * while the status is already 'error'. A failure that happens while online with nothing waiting
 * offline is not retried here, so a server error cannot turn into a retry loop.
 */
export function useRetrySaveOnReconnect(
  saveStatus: NoteSaveStatus,
  isOnline: boolean,
  retry: () => void,
) {
  const editsWaitedOffline = useRef(false);

  useEffect(() => {
    if (!isOnline) {
      if (saveStatus !== 'saved') {
        editsWaitedOffline.current = true;
      }
      return;
    }
    if (saveStatus === 'saved') {
      editsWaitedOffline.current = false;
      return;
    }
    if (saveStatus === 'error' && editsWaitedOffline.current) {
      editsWaitedOffline.current = false;
      retry();
    }
  }, [isOnline, retry, saveStatus]);
}
