import * as LocalAuthentication from 'expo-local-authentication';
import { useCallback, useRef, useState, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';

import { APP_NAME } from '~/constants';
import { storage } from '~/services/storage/mmkv';

const LOCK_ENABLED_KEY = 'app_lock_enabled';

export function getAppLockEnabled(): boolean {
  return storage.getBoolean(LOCK_ENABLED_KEY) ?? false;
}

export function setAppLockEnabled(value: boolean) {
  storage.set(LOCK_ENABLED_KEY, value);
}

export function useAppLock() {
  const enabled = getAppLockEnabled();
  const [isUnlocked, setIsUnlocked] = useState(!enabled);
  const appState = useRef(AppState.currentState);

  const authenticate = useCallback(async () => {
    if (!enabled) {
      setIsUnlocked(true);
      return;
    }

    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();

    if (!hasHardware || !isEnrolled) {
      setIsUnlocked(true);
      return;
    }

    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: `Unlock ${APP_NAME}`,
      fallbackLabel: 'Use passcode',
      cancelLabel: 'Cancel',
    });

    if (result.success) {
      setIsUnlocked(true);
    }
  }, [enabled]);

  const subscribe = useCallback(
    (_onStoreChange: () => void) => {
      void authenticate();

      if (!enabled) {
        return () => {};
      }

      const subscription = AppState.addEventListener('change', (nextState) => {
        if (appState.current === 'background' && nextState === 'active') {
          setIsUnlocked(false);
          void authenticate();
        }
        appState.current = nextState;
      });

      return () => {
        subscription.remove();
      };
    },
    [enabled, authenticate],
  );

  useSyncExternalStore(
    subscribe,
    () => 0,
    () => 0,
  );

  return { isUnlocked, authenticate };
}
