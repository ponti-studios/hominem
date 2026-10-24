import { useSyncExternalStore } from 'react';
import { AccessibilityInfo } from 'react-native';

let reducedMotionSnapshot = false;
const reducedMotionListeners = new Set<() => void>();
let reducedMotionInitialized = false;

function emitReducedMotionChange() {
  for (const listener of reducedMotionListeners) {
    listener();
  }
}

function ensureReducedMotionSnapshot() {
  if (reducedMotionInitialized) {
    return;
  }

  reducedMotionInitialized = true;
  void AccessibilityInfo.isReduceMotionEnabled().then((value) => {
    reducedMotionSnapshot = value;
    emitReducedMotionChange();
  });
}

function subscribeReducedMotion(listener: () => void) {
  reducedMotionListeners.add(listener);
  ensureReducedMotionSnapshot();

  const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', (value) => {
    reducedMotionSnapshot = value;
    emitReducedMotionChange();
  });

  return () => {
    reducedMotionListeners.delete(listener);
    subscription.remove();
  };
}

export function useReducedMotion() {
  return useSyncExternalStore(
    subscribeReducedMotion,
    () => reducedMotionSnapshot,
    () => false,
  );
}
