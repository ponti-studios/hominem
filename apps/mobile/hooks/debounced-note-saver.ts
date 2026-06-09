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
  persist,
}: {
  commit: (note: Note) => void;
  delayMs: number;
  persist: (payload: NoteSavePayload) => Promise<Note>;
}) {
  let pending: PendingNoteSave | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let version = 0;

  const clearTimer = () => {
    if (timer === null) return;
    clearTimeout(timer);
    timer = null;
  };

  const persistPending = (next: PendingNoteSave) => {
    void persist(next.payload)
      .then((note) => {
        if (next.version === version) {
          commit(note);
        }
      })
      .catch(() => undefined);
  };

  const flush = () => {
    if (!pending) return;
    const next = pending;
    pending = null;
    clearTimer();
    persistPending(next);
  };

  return {
    flush,
    schedule: (payload: NoteSavePayload) => {
      version += 1;
      pending = { payload, version };
      clearTimer();
      timer = setTimeout(flush, delayMs);
    },
  };
}
