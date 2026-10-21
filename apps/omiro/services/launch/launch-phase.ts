import { useSyncExternalStore } from 'react';

import { E2E_TESTING } from '~/constants';

// 'splash': the launch overlay is covering the app. 'travel': it is handing the mascot to the login
// screen, which starts revealing its form. 'done': the overlay is gone and the screen under it owns
// the brand. Module state because the overlay sits above the router, outside any screen.
type LaunchPhase = 'splash' | 'travel' | 'done';

let phase: LaunchPhase = E2E_TESTING ? 'done' : 'splash';
const listeners = new Set<() => void>();

export function setLaunchPhase(next: LaunchPhase) {
  if (phase === next) {
    return;
  }
  phase = next;
  listeners.forEach((listener) => listener());
}

export function useLaunchPhase() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => phase,
    () => phase,
  );
}
