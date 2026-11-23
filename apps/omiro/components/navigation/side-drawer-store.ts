import { useSyncExternalStore } from 'react';

// Whether the side drawer is open. A header button (a native bar item, which
// cannot reach React context) opens it, so the state lives here.
let isOpen = false;
const listeners = new Set<() => void>();

export function setSideDrawerOpen(next: boolean) {
  if (isOpen === next) {
    return;
  }
  isOpen = next;
  for (const listener of listeners) {
    listener();
  }
}

export function useSideDrawerOpen() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    () => isOpen,
    () => false,
  );
}
