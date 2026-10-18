/** The real dependencies for deleting an account: the provider keys and the file storage. */
import { fileStorageService } from '@hominem/storage';
import { logger } from '@hominem/telemetry';

import { env } from '../env';
import type { DeleteAccountDeps } from './account';
import { devBase } from './credit.runtime';
import { createOpenRouterKeys } from './openrouter-keys';
import { revokeAllCredentials, type CredentialDeps } from './provider-credentials';
import { dbCredentialStore } from './provider-credentials.store';

export function deleteAccountDeps(): DeleteAccountDeps {
  return {
    async endKeys(userId) {
      // No management key means no provider keys were ever minted here.
      if (!env.OPENROUTER_MANAGEMENT_KEY) return;
      const deps: CredentialDeps = {
        store: dbCredentialStore,
        keys: createOpenRouterKeys(
          env.OPENROUTER_MANAGEMENT_KEY,
          fetch,
          devBase(env.OPENROUTER_KEYS_BASE_URL),
        ),
        capUsd: env.THAMES_MONTHLY_CAP_USD,
        log: (event, fields) => logger.error(event, fields),
      };
      await revokeAllCredentials(deps, userId);
      // A failed provider call is only logged there. Deleting now would cascade away the rows the
      // reaper needs, leaving a live key nobody can end, so stop and let the person try again.
      const stillLive = (await dbCredentialStore.rows(userId)).filter(
        (row) => row.disabledAt === null,
      );
      if (stillLive.length > 0) {
        throw new Error('Could not end your provider keys. Try again in a moment.');
      }
    },
    async removeStoredFile(fileId, userId) {
      await fileStorageService.deleteFile(fileId, userId);
    },
  };
}
