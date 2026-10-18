/** The real dependencies for deleting an account: the provider keys and the file storage. */
import { fileStorageService } from '@hominem/storage';
import { logger } from '@hominem/telemetry';

import { env } from '../env';
import type { DeleteAccountDeps } from './account';
import { devBase } from './credit.runtime';
import { createOpenRouterKeys } from './openrouter-keys';
import { revokeAllCredentials } from './provider-credentials';
import { dbCredentialStore } from './provider-credentials.store';

export function deleteAccountDeps(): DeleteAccountDeps {
  return {
    async endKeys(userId) {
      // No management key means no provider keys were ever minted here.
      if (!env.OPENROUTER_MANAGEMENT_KEY) return;
      await revokeAllCredentials(
        {
          store: dbCredentialStore,
          keys: createOpenRouterKeys(
            env.OPENROUTER_MANAGEMENT_KEY,
            fetch,
            devBase(env.OPENROUTER_KEYS_BASE_URL),
          ),
          capUsd: env.THAMES_MONTHLY_CAP_USD,
          log: (event, fields) => logger.error(event, fields),
        },
        userId,
      );
    },
    async removeStoredFile(fileId, userId) {
      await fileStorageService.deleteFile(fileId, userId);
    },
  };
}
