import * as ScreenCapture from 'expo-screen-capture';
import { useCallback, useSyncExternalStore } from 'react';

import { E2E_TESTING } from '~/constants';
import { storage } from '~/services/storage/mmkv';

const PREVENT_SCREENSHOTS_KEY = 'prevent_screenshots';

export function getPreventScreenshots(): boolean {
  return storage.getBoolean(PREVENT_SCREENSHOTS_KEY) ?? false;
}

export function setPreventScreenshots(value: boolean) {
  storage.set(PREVENT_SCREENSHOTS_KEY, value);
}

export function useScreenCapture() {
  const enabled = getPreventScreenshots();

  const subscribe = useCallback(
    (_onStoreChange: () => void) => {
      if (E2E_TESTING) {
        return () => {};
      }

      if (enabled) {
        void ScreenCapture.preventScreenCaptureAsync();
      } else {
        void ScreenCapture.allowScreenCaptureAsync();
      }

      return () => {};
    },
    [enabled],
  );

  useSyncExternalStore(
    subscribe,
    () => enabled,
    () => enabled,
  );
}
