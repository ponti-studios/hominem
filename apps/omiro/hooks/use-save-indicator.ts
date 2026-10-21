import { useEffect, useRef, useState } from 'react';

import type { NoteSaveStatus } from './use-note-editor';

/** A save has to run this long before the dot shows up, so normal typing never flashes it. */
export const SAVE_INDICATOR_GRACE_MS = 1200;
/** How long the green "saved" dot stays before it fades away. */
export const SAVE_INDICATOR_LINGER_MS = 1500;

export type SaveIndicator = 'none' | 'saving' | 'saved' | 'offline' | 'error';

/**
 * Turns the raw save status into what the header shows. Saved and fast saves show nothing; a save
 * that runs long pulses a dot, and only a dot that was seen turns green on success. Trouble (a
 * failed save, or no connection with edits waiting) stays up until it clears.
 */
export function useSaveIndicator(saveStatus: NoteSaveStatus, isOnline: boolean): SaveIndicator {
  const [shown, setShown] = useState<SaveIndicator>('none');
  const shownRef = useRef<SaveIndicator>('none');
  const graceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lingerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const show = (next: SaveIndicator) => {
      shownRef.current = next;
      setShown(next);
    };
    const clearTimers = () => {
      if (graceTimer.current) {
        clearTimeout(graceTimer.current);
        graceTimer.current = null;
      }
      if (lingerTimer.current) {
        clearTimeout(lingerTimer.current);
        lingerTimer.current = null;
      }
    };

    if (saveStatus === 'error') {
      clearTimers();
      show('error');
      return clearTimers;
    }

    if (saveStatus === 'saving') {
      if (lingerTimer.current) {
        clearTimeout(lingerTimer.current);
        lingerTimer.current = null;
      }
      if (shownRef.current === 'none') {
        // Keep an already-running grace period: every keystroke re-enters 'saving' only once, but a
        // fresh save right after a quick one must not restart the clock.
        if (!graceTimer.current) {
          graceTimer.current = setTimeout(() => {
            graceTimer.current = null;
            show('saving');
          }, SAVE_INDICATOR_GRACE_MS);
        }
      } else {
        show('saving');
      }
      return undefined;
    }

    // saved
    clearTimers();
    if (shownRef.current === 'saving' || shownRef.current === 'error') {
      show('saved');
      lingerTimer.current = setTimeout(() => {
        lingerTimer.current = null;
        show('none');
      }, SAVE_INDICATOR_LINGER_MS);
    }
    return undefined;
  }, [saveStatus]);

  useEffect(
    () => () => {
      if (graceTimer.current) {
        clearTimeout(graceTimer.current);
      }
      if (lingerTimer.current) {
        clearTimeout(lingerTimer.current);
      }
    },
    [],
  );

  // Offline only matters while edits are waiting; a saved note is saved wherever you are.
  if (!isOnline && saveStatus !== 'saved') {
    return 'offline';
  }
  return shown;
}
