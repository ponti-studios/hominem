import { storage } from '~/services/storage/mmkv';

const TEST_MODE_KEY = '__e2e_test_mode__';

export const MOCK_AI_RESPONSE = 'mock AI response';

export function isTestMode(): boolean {
  try {
    return storage.getBoolean(TEST_MODE_KEY) === true;
  } catch {
    return false;
  }
}

export function enableTestMode(): void {
  try {
    storage.set(TEST_MODE_KEY, true);
  } catch {
    // MMKV unavailable — no-op
  }
}

export function disableTestMode(): void {
  try {
    storage.remove(TEST_MODE_KEY);
  } catch {
    // MMKV unavailable — no-op
  }
}
