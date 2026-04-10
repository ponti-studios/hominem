import * as ScreenCapture from 'expo-screen-capture';
import { useEffect } from 'react';

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

  useEffect(() => {
    if (E2E_TESTING) {
      return;
    }

    if (enabled) {
      void ScreenCapture.preventScreenCaptureAsync();
    } else {
      void ScreenCapture.allowScreenCaptureAsync();
    }
  }, [enabled]);
}
