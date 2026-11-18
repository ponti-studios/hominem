import type { QueryClient } from '@tanstack/react-query';

import { clearPersistedQueryCache } from '~/services/query-persistence';
import { LocalStore } from '~/services/storage/local-store';
import { clearSpotlight } from '~/services/system/spotlight';
import { clearTaskData } from '~/services/tasks/task-service-instance';

// Wipes every local trace of the signed-out session (query cache, its
// persisted copy, local-store data, and the Spotlight index) so a stale, possibly wrong-account
// cache can't survive into the next sign-in.
export async function clearLocalSessionState(queryClient: QueryClient) {
  queryClient.clear();
  await clearPersistedQueryCache();
  await LocalStore.clearAllData();
  clearTaskData();
  await clearSpotlight();
}
