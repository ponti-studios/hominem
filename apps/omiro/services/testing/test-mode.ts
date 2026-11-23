import { storage } from '~/services/storage/mmkv';

const TEST_MODE_KEY = '__e2e_test_mode__';

export function enableTestMode(): void {
  try {
    storage.set(TEST_MODE_KEY, true);
  } catch {
    // MMKV unavailable — no-op
  }
}
