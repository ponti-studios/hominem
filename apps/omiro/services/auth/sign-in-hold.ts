import { useSyncExternalStore } from 'react';

// While the login screen plays its success moment the session is already signed in, and the route
// guards would cut the animation short by redirecting to the inbox. Holding the redirect for a beat
// lets the screen finish; releasing it lets the guards move on.
let holding = false;
const listeners = new Set<() => void>();

export function setSignInHold(next: boolean) {
  if (holding === next) {
    return;
  }
  holding = next;
  listeners.forEach((listener) => listener());
}

export function useSignInHold() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => holding,
    () => holding,
  );
}
