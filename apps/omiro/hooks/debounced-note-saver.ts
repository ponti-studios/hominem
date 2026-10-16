import type { Note } from '@hominem/rpc/types';

export interface NoteSavePayload {
  content: string;
  fileIds: string[];
  title: string | null;
}

interface PendingNoteSave {
  payload: NoteSavePayload;
  version: number;
}

export function createDebouncedNoteSaver({
  commit,
  delayMs,
  onError,
  onSkip,
  persist,
}: {
  commit: (note: Note) => void;
  delayMs: number;
  onError?: (error: unknown) => void;
  /** Called when a save is not sent because the note is empty (the server refuses empty notes). */
  onSkip?: () => void;
  persist: (payload: NoteSavePayload) => Promise<Note>;
}) {
  let pending: PendingNoteSave | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let draining: Promise<void> | null = null;
  let version = 0;

  const clearTimer = () => {
    if (timer === null) {
      return;
    }
    clearTimeout(timer);
    timer = null;
  };

  const persistPending = async (next: PendingNoteSave) => {
    if (next.payload.content.trim().length === 0) {
      if (next.version === version) {
        onSkip?.();
      }
      return;
    }
    try {
      const note = await persist(next.payload);
      if (next.version === version) {
        commit(note);
      }
    } catch (error) {
      if (next.version === version) {
        onError?.(error);
      }
    }
  };

  // One request at a time, so a slow earlier save can never land after a later one. Edits made
  // while a request is in flight replace each other; only the newest is sent next.
  const drain = () => {
    if (!draining) {
      draining = (async () => {
        try {
          while (pending) {
            const next = pending;
            pending = null;
            await persistPending(next);
          }
        } finally {
          draining = null;
        }
      })();
    }
    return draining;
  };

  const flush = () => {
    if (!pending) {
      return;
    }
    clearTimer();
    void drain();
  };

  return {
    flush,
    persistNow: async (payload: NoteSavePayload) => {
      version += 1;
      pending = { payload, version };
      clearTimer();
      await drain();
    },
    schedule: (payload: NoteSavePayload) => {
      version += 1;
      pending = { payload, version };
      clearTimer();
      timer = setTimeout(flush, delayMs);
    },
  };
}
