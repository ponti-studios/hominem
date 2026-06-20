import { Redirect } from 'expo-router';

import { enableTestMode } from '~/services/testing/test-mode';

// Synchronous module-level call so MMKV is written before React renders/effects run.
enableTestMode();

export default function EnableTestMode() {
  return <Redirect href="/" />;
}
